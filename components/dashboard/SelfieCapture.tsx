"use client";

/**
 * IDENTITY VERIFICATION FORM — the NIN plus a photo taken here, now.
 *
 * The photo is captured from the camera rather than chosen from storage: a
 * file picker would let somebody send a saved picture of another person. There
 * is deliberately no upload fallback.
 *
 * ── WHY THE VIDEO ELEMENT IS ALWAYS MOUNTED ──────────────────────────────
 * It used to be rendered only while the stage was "live", with the stream
 * attached inside a requestAnimationFrame after setStage. That frame can run
 * BEFORE React commits the DOM, so videoRef.current was still null, the
 * attach silently did nothing, and the preview stayed black for good — no
 * error, no way back. That is the blank-camera bug.
 *
 * Now the <video> is in the DOM from first render (hidden with opacity, not
 * unmounted) so the ref is always valid, and the stream is attached in an
 * effect that by definition runs after commit. Nothing depends on timing.
 *
 * ── WHY getUserMedia FAILS, AND WHAT WE SAY ──────────────────────────────
 * Every branch below reports something the user can act on, because "it didn't
 * work" on a camera is almost always one of four fixable things: the page is
 * not on https, permission was denied, another app holds the camera, or the
 * requested resolution is not available. The last one gets a second attempt
 * with no constraints at all before we give up.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { submitKyc } from "@/app/actions/kyc";
import { ERRORS } from "@/lib/errors";
import type { FormState } from "@/app/actions/auth";

/** Long edge of the stored photo — plenty to recognise a face by. */
const SELFIE_WIDTH = 900;
const JPEG_QUALITY = 0.82;

const input =
  "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 transition-colors";
const label = "block text-xs font-bold text-slate-700 mb-1.5";

type Stage = "idle" | "starting" | "live" | "captured";

/** Turns a getUserMedia rejection into something the user can do about it. */
function cameraMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return ERRORS.KYC_CAMERA_BLOCKED;
    case "NotFoundError":
    case "DevicesNotFoundError":
      return ERRORS.KYC_CAMERA_MISSING;
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return ERRORS.KYC_CAMERA_IN_USE;
    default:
      return ERRORS.KYC_CAMERA_BLOCKED;
  }
}

export default function SelfieCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  /** The exact failure, shown small — it is what makes a report diagnosable. */
  const [detail, setDetail] = useState<string | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

  const [state, setState] = useState<FormState>(undefined);
  const [pending, setPending] = useState(false);

  // ── Attach the stream, after the DOM exists ──────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;

    // play() is a promise and it does reject — muted autoplay is usually
    // allowed, but not on every Android browser. A swallowed rejection here
    // was the second way this could end up as a black box.
    void video.play().catch((err: unknown) => {
      setCameraError(ERRORS.KYC_CAMERA_BLOCKED);
      setDetail(err instanceof Error ? `play(): ${err.name}` : "play() was refused");
    });

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  // ── Let the camera go when we are done with it or the user leaves ────────
  useEffect(() => {
    if (!stream) return;
    return () => stream.getTracks().forEach((t) => t.stop());
  }, [stream]);

  const stopCamera = useCallback(() => setStream(null), []);

  async function startCamera() {
    setCameraError(null);
    setDetail(null);
    setStage("starting");

    // getUserMedia only exists in a secure context. On plain http over a LAN
    // address the whole API is simply missing, which otherwise reads as "no
    // camera on this device" and sends people looking for the wrong problem.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCameraError(ERRORS.KYC_CAMERA_INSECURE);
      setDetail(`page is on ${window.location.protocol}//`);
      setStage("idle");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(ERRORS.KYC_CAMERA_INSECURE);
      setDetail("navigator.mediaDevices is unavailable");
      setStage("idle");
      return;
    }

    // Ask for a front camera at a useful size; if the device cannot give
    // exactly that, take whatever camera it has rather than failing.
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false },
      { video: { facingMode: "user" }, audio: false },
      { video: true, audio: false },
    ];

    let lastError: unknown = null;
    for (const constraints of attempts) {
      try {
        const next = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(next);
        setStage("live");
        return;
      } catch (err) {
        lastError = err;
        const name = err instanceof Error ? err.name : "";
        // A refused permission will not change with looser constraints.
        if (name === "NotAllowedError" || name === "SecurityError") break;
      }
    }

    setCameraError(cameraMessage(lastError));
    setDetail(lastError instanceof Error ? `${lastError.name}: ${lastError.message}` : null);
    setStage("idle");
  }

  function capture() {
    const video = videoRef.current;

    // videoWidth is 0 until metadata arrives. Tapping before then used to do
    // nothing at all; now it says so.
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError(ERRORS.KYC_CAMERA_NOT_READY);
      return;
    }

    setCameraError(null);

    const scale = SELFIE_WIDTH / video.videoWidth;
    const canvas = document.createElement("canvas");
    canvas.width = SELFIE_WIDTH;
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError(ERRORS.KYC_PHOTO_FAILED);
      setDetail("no 2d canvas context");
      return;
    }

    // The preview is mirrored so it feels like a mirror; the stored photo is
    // drawn unmirrored, the way whoever reviews it expects to see a face.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          // Used to return silently, which left the submit button disabled
          // with nothing on screen explaining why.
          setCameraError(ERRORS.KYC_PHOTO_FAILED);
          setDetail("canvas.toBlob returned nothing");
          return;
        }
        setShot((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { blob, url: URL.createObjectURL(blob) };
        });
        setStage("captured");
        stopCamera();
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  }

  function retake() {
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setState(undefined);
    void startCamera();
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    if (!shot) {
      setState({ errors: { selfie: ERRORS.KYC_SELFIE_REQUIRED } });
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("selfie", shot.blob, "selfie.jpg");

    setPending(true);
    try {
      setState(await submitKyc(undefined, formData));
    } catch {
      setState({ message: ERRORS.KYC_SUBMIT_FAILED });
    } finally {
      setPending(false);
    }
  }

  if (state?.success) {
    return (
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3.5">
        {state.message}
      </p>
    );
  }

  const live = stage === "live";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {state?.message && !state.success && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
          {state.message}
        </p>
      )}

      {/* ── 1. The number ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 shrink-0 rounded-full bg-[#0d2137] text-white text-[10px] font-extrabold grid place-items-center">
            1
          </span>
          <h3 className="text-sm font-extrabold text-slate-900">Your NIN</h3>
        </div>

        <div>
          <label htmlFor="kyc-number" className={label}>
            National Identification Number
          </label>
          <input
            id="kyc-number"
            name="idNumber"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={16}
            required
            placeholder="11 digits"
            className={`${input} tabular-nums tracking-wide`}
          />
          {state?.errors?.idNumber && (
            <p className="text-[11px] text-red-600 mt-1.5">{state.errors.idNumber}</p>
          )}
          <p className="mt-1.5 text-[11px] text-slate-400">
            Dial *346# on your registered line if you don&apos;t have it to hand.
          </p>
        </div>
      </div>

      {/* ── 2. The photo ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 shrink-0 rounded-full bg-[#0d2137] text-white text-[10px] font-extrabold grid place-items-center">
            2
          </span>
          <h3 className="text-sm font-extrabold text-slate-900">A photo of your face</h3>
        </div>

        <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-slate-900 grid place-items-center">
          {/* Always mounted, never conditionally rendered — see the note at the
              top of this file. Hidden with opacity when there is nothing to
              show, so the ref is valid from the very first render. */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`absolute inset-0 h-full w-full object-cover scale-x-[-1] transition-opacity duration-200 ${
              live ? "opacity-100" : "opacity-0"
            }`}
          />

          {live && (
            /* A soft oval to line the face up with. */
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-[78%] aspect-3/4 rounded-[50%] border-2 border-white/50" />
            </div>
          )}

          {stage === "captured" && shot && (
            /* eslint-disable-next-line @next/next/no-img-element -- a blob: URL from the camera, nothing to optimise */
            <img
              src={shot.url}
              alt="The photo you just took"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {(stage === "idle" || stage === "starting") && (
            <div className="relative px-6 text-center">
              <svg
                className="mx-auto mb-3 h-10 w-10 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                />
              </svg>
              <p className="text-xs text-slate-400">
                {stage === "starting"
                  ? "Opening your camera..."
                  : "Your camera preview appears here"}
              </p>
            </div>
          )}
        </div>

        {cameraError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
            <p className="text-xs text-red-600">{cameraError}</p>
            {detail && <p className="mt-1 font-mono text-[10px] text-red-400">{detail}</p>}
          </div>
        )}
        {state?.errors?.selfie && <p className="text-[11px] text-red-600">{state.errors.selfie}</p>}

        {stage === "idle" || stage === "starting" ? (
          <button
            type="button"
            onClick={startCamera}
            disabled={stage === "starting"}
            className="py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl transition-all duration-150 disabled:opacity-50"
          >
            {stage === "starting" ? "Opening camera..." : "Open camera"}
          </button>
        ) : live ? (
          <button
            type="button"
            onClick={capture}
            className="py-3 px-4 bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-[#0d2137] font-extrabold text-sm rounded-xl transition-all duration-150"
          >
            Take the photo
          </button>
        ) : (
          <button
            type="button"
            onClick={retake}
            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
          >
            Take it again
          </button>
        )}

        <ul className="text-[11px] text-slate-500 leading-relaxed list-disc pl-4 space-y-0.5">
          <li>Face the light, not a window behind you.</li>
          <li>No cap, sunglasses or face covering.</li>
          <li>Hold still until the picture is sharp.</li>
        </ul>
      </div>

      <button
        type="submit"
        disabled={pending || !shot}
        className="py-3.5 px-4 bg-[#0d2137] hover:bg-[#14314f] active:scale-[0.99] text-white font-extrabold text-sm rounded-xl transition-all duration-150 disabled:opacity-40 disabled:active:scale-100"
      >
        {pending ? "Sending..." : "Submit for verification"}
      </button>
    </form>
  );
}
