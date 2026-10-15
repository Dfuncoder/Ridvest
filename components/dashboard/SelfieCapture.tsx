"use client";

/**
 * IDENTITY VERIFICATION FORM — the ID number plus a photo taken here, now.
 *
 * The photo is captured from the camera rather than chosen from storage: a
 * file picker would let somebody send a saved picture of another person. There
 * is deliberately no upload fallback.
 *
 * Captured frames are drawn to a canvas, scaled to SELFIE_WIDTH and encoded as
 * JPEG, which keeps the submission comfortably inside the Server Action body
 * limit without the user having to think about file sizes.
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

export default function SelfieCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

  const [state, setState] = useState<FormState>(undefined);
  const [pending, setPending] = useState(false);

  // ── Camera lifecycle ─────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Release the camera if the user navigates away mid-flow, so the recording
  // indicator does not stay lit.
  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setStage("starting");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(ERRORS.KYC_CAMERA_MISSING);
      setStage("idle");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setStage("live");
      // The video element only exists once the stage is "live", so attach on
      // the next frame rather than to a ref that is still null.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setCameraError(
        name === "NotFoundError" || name === "OverconstrainedError"
          ? ERRORS.KYC_CAMERA_MISSING
          : ERRORS.KYC_CAMERA_BLOCKED
      );
      setStage("idle");
    }
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const scale = SELFIE_WIDTH / video.videoWidth;
    const canvas = document.createElement("canvas");
    canvas.width = SELFIE_WIDTH;
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // The preview is mirrored so it feels like a mirror; the stored photo is
    // drawn unmirrored, the way whoever reviews it expects to see a face.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
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

  // On success the page re-renders into the pending state and this form goes
  // away — this covers the moment before that lands.
  if (state?.success) {
    return (
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3.5">
        {state.message}
      </p>
    );
  }

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
          <h3 className="text-sm font-extrabold text-slate-900">Your NIN or BVN</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
          <div>
            <label htmlFor="kyc-type" className={label}>
              Which one
            </label>
            <select id="kyc-type" name="idType" defaultValue="nin" className={input}>
              <option value="nin">NIN</option>
              <option value="bvn">BVN</option>
            </select>
          </div>
          <div>
            <label htmlFor="kyc-number" className={label}>
              Number
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
            {state?.errors?.idType && (
              <p className="text-[11px] text-red-600 mt-1.5">{state.errors.idType}</p>
            )}
          </div>
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
          {stage === "live" && (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
              />
              {/* A soft oval to line the face up with. */}
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="h-[78%] aspect-3/4 rounded-[50%] border-2 border-white/50" />
              </div>
            </>
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
            <div className="px-6 text-center">
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
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
            {cameraError}
          </p>
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
        ) : stage === "live" ? (
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
