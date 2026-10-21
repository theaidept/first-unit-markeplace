import { useEffect, useRef, useState } from "react";
import { ImagePlus, Film, Upload } from "lucide-react";
import api, { fileUrl, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";

const IMG_OK = ["image/jpeg", "image/png", "image/webp"];
const VID_OK = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];
const STORY_RATIO = 9 / 16;
const TILE_RATIO = 1;
const SLACK = 0.045;

export function placementMedia(placeKey) {
  const story = placeKey === "story";
  return {
    story,
    ratio: story ? STORY_RATIO : TILE_RATIO,
    outW: 1080,
    outH: story ? 1920 : 1080,
    label: story ? "9:16 story · 1080 × 1920" : "1:1 tile · 1080 × 1080",
    acceptImg: "image/jpeg,image/png,image/webp",
    acceptVid: "video/mp4,video/quicktime,video/webm,video/x-m4v",
  };
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Could not read that image"));
    im.src = src;
  });
}

function ratioClose(w, h, want) {
  if (!w || !h) return false;
  return Math.abs(w / h - want) / want <= SLACK;
}

async function uploadBlob(blob, name, asVideo) {
  const fd = new FormData();
  fd.append("file", blob, name);
  const { data } = await api.post(asVideo ? "/upload/video?aspect=9x16" : "/upload", fd);
  return data.url;
}

function posterFromVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    const fail = (msg) => { URL.revokeObjectURL(url); reject(new Error(msg)); };
    v.onerror = () => fail("Could not read that video");
    v.onloadeddata = () => {
      try { v.currentTime = Math.min(0.15, (v.duration || 1) * 0.02); } catch { /* wait */ }
    };
    v.onseeked = () => {
      if (!v.videoWidth) { fail("Could not read video size"); return; }
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0);
      c.toBlob((b) => {
        URL.revokeObjectURL(url);
        if (!b) fail("Could not grab a poster frame");
        else resolve({ blob: b, w: v.videoWidth, h: v.videoHeight });
      }, "image/jpeg", 0.9);
    };
  });
}

function CropModal({ src, wantRatio, outW, outH, onCancel, onDone }) {
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const drag = useRef(null);
  const [zoom, setZoom] = useState(1.08);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [busy, setBusy] = useState(false);
  const story = wantRatio < 1;

  const onPtr = (e) => {
    if (!e.isPrimary) return;
    drag.current = { x: e.clientX - tx, y: e.clientY - ty };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    setTx(e.clientX - drag.current.x);
    setTy(e.clientY - drag.current.y);
  };
  const onUp = () => { drag.current = null; };

  const apply = async () => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img || !img.naturalWidth) return;
    setBusy(true);
    try {
      const s = stage.getBoundingClientRect();
      const r = img.getBoundingClientRect();
      const scale = img.naturalWidth / r.width;
      const sx = Math.max(0, (s.left - r.left) * scale);
      const sy = Math.max(0, (s.top - r.top) * scale);
      const sw = Math.min(img.naturalWidth - sx, s.width * scale);
      const sh = Math.min(img.naturalHeight - sy, s.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
      if (!blob) throw new Error("Crop failed");
      await onDone(blob);
    } catch (err) {
      toast.error(err.message || "Crop failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="ads-crop-scrim" onClick={onCancel} data-testid="ad-crop-modal">
      <div className="ads-crop-card" onClick={(e) => e.stopPropagation()}>
        <div className="ads-preview-h">
          <div>
            <b>Crop to {outW} × {outH}</b>
            <small>Drag to position. Zoom to fill the {story ? "9:16 story" : "1:1 tile"}.</small>
          </div>
          <button type="button" className="ap-btn" onClick={onCancel}>Cancel</button>
        </div>
        <div
          ref={stageRef}
          className={`ads-crop-stage ${story ? "story" : "tile"}`}
          onPointerDown={onPtr}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            style={{ transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${zoom})` }}
          />
        </div>
        <label className="ads-crop-zoom">
          Zoom
          <input type="range" min="1" max="2.4" step="0.02" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        <button type="button" className="abtn primary" onClick={apply} disabled={busy} data-testid="ad-crop-apply">
          {busy ? "Saving crop…" : "Use this crop"}
        </button>
      </div>
    </div>
  );
}

export function AdMediaPicker({ placeKey, image, video, onChange }) {
  const spec = placementMedia(placeKey);
  const imgRef = useRef(null);
  const vidRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [crop, setCrop] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => () => {
    if (crop?.src?.startsWith("blob:")) URL.revokeObjectURL(crop.src);
  }, [crop]);

  const pushImage = async (blob, name = "ad.jpg") => {
    const label = name || "picture";
    setNotice({ tone: "busy", text: `Uploading picture — ${label}` });
    setBusy(true);
    try {
      const url = await uploadBlob(blob, name, false);
      onChange({ image: url, video: video || "" });
      const text = `Image upload successful — ${label}`;
      setNotice({ tone: "ok", text });
      toast.success(text, { duration: 5000 });
    } catch (err) {
      const text = `${formatApiErrorDetail(err.response?.data?.detail)} — or paste an image URL below`;
      setNotice({ tone: "err", text: "Image upload failed" });
      toast.error(text);
    } finally { setBusy(false); }
  };

  const openCrop = (src) => {
    if (crop?.src?.startsWith("blob:")) URL.revokeObjectURL(crop.src);
    setCrop({ src, wantRatio: spec.ratio, outW: spec.outW, outH: spec.outH });
  };

  const handleImageFile = async (file) => {
    if (!file) return;
    if (!IMG_OK.includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name || "")) {
      toast.error("Use a JPG, PNG or WebP image");
      return;
    }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8 MB"); return; }
    const src = URL.createObjectURL(file);
    try {
      const im = await loadImg(src);
      if (ratioClose(im.naturalWidth, im.naturalHeight, spec.ratio)) {
        URL.revokeObjectURL(src);
        await pushImage(file, file.name || "ad.jpg");
        return;
      }
      openCrop(src);
    } catch {
      URL.revokeObjectURL(src);
      toast.error("Could not read that image");
    }
  };

  const handleVideoFile = async (file) => {
    if (!file) return;
    if (!spec.story) { toast.error("Video is only for Story ads"); return; }
    if (!VID_OK.includes(file.type) && !/\.(mp4|mov|webm|m4v)$/i.test(file.name || "")) {
      toast.error("Use MP4, MOV or WEBM");
      return;
    }
    if (file.size > 80 * 1024 * 1024) { toast.error("Video must be under 80 MB"); return; }
    const label = file.name || "video";
    setNotice({ tone: "busy", text: `Uploading video — ${label}` });
    setBusy(true);
    try {
      const { blob, w, h } = await posterFromVideo(file);
      if (!ratioClose(w, h, STORY_RATIO)) {
        const text = "This video is not 9:16 (1080 × 1920). Crop it in CapCut, Premiere or similar, then upload again.";
        setNotice({ tone: "err", text });
        toast.error(text);
        return;
      }
      const vurl = await uploadBlob(file, file.name || "ad.mp4", true);
      const purl = await uploadBlob(blob, "poster.jpg", false);
      onChange({ image: purl, video: vurl });
      const text = `Video upload successful — ${label}`;
      setNotice({ tone: "ok", text });
      toast.success(text, { duration: 5000 });
    } catch (err) {
      const text = formatApiErrorDetail(err.response?.data?.detail) || err.message || "Video upload failed";
      setNotice({ tone: "err", text: "Video upload failed" });
      toast.error(text);
    } finally { setBusy(false); }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setHover(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (f.type.startsWith("video/")) handleVideoFile(f);
    else handleImageFile(f);
  };

  const preview = fileUrl(image);
  const publicLink = /^https?:\/\//i.test(image || "") ? image : "";

  return (
    <div className="ads-media" data-testid="ad-media-picker">
      <label>Ad creative · {spec.label}</label>
      <div
        className={`ads-drop ${spec.story ? "story" : "tile"} ${hover ? "hover" : ""} ${preview ? "has" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
      >
        {preview ? (
          video ? (
            <video className="ads-drop-preview" src={fileUrl(video)} poster={preview} muted playsInline />
          ) : (
            <img className="ads-drop-preview" src={preview} alt="" />
          )
        ) : (
          <div className="ads-drop-empty">
            <Upload size={22} />
            <b>Drop {spec.story ? "a 9:16 story" : "a square image"} here</b>
            <span>Drag and drop only. Use the buttons below to browse.</span>
          </div>
        )}
      </div>
      <div className="ads-drop-actions">
        <button type="button" className="ads-choose" onClick={() => imgRef.current?.click()} disabled={busy} data-testid="ad-choose-image">
          <ImagePlus size={16} /> {spec.story ? "Choose 9:16 image" : "Choose 1:1 image"}
        </button>
        {spec.story ? (
          <button type="button" className="ads-choose alt" onClick={() => vidRef.current?.click()} disabled={busy} data-testid="ad-choose-video">
            <Film size={16} /> Choose 9:16 video
          </button>
        ) : null}
        {image ? (
          <button type="button" className="ads-choose ghost" onClick={() => { setNotice(null); onChange({ image: "", video: "" }); }} disabled={busy}>
            Remove
          </button>
        ) : null}
      </div>
      <p className="ads-drop-hint">
        {spec.story
          ? "Stories need vertical 1080 × 1920. Off-size photos open a crop box. Off-size video is rejected."
          : "Square 1080 × 1080. Drop a photo — we crop if it is not square."}
      </p>
      <input ref={imgRef} type="file" accept={spec.acceptImg} hidden onChange={(e) => { handleImageFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="ad-image" />
      <input ref={vidRef} type="file" accept={spec.acceptVid} hidden onChange={(e) => { handleVideoFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="ad-video" />
      {notice ? <div className={`ads-upload-note ${notice.tone}`} role="status" aria-live="polite">{notice.text}</div> : null}
      <input
        className="ads-url-input"
        value={publicLink}
        onChange={(e) => onChange({ image: e.target.value, video: "" })}
        placeholder="Or paste a public image link (https://…)"
        data-testid="ad-image-url"
      />
      {crop ? (
        <CropModal
          src={crop.src}
          wantRatio={crop.wantRatio}
          outW={crop.outW}
          outH={crop.outH}
          onCancel={() => {
            if (crop.src.startsWith("blob:")) URL.revokeObjectURL(crop.src);
            setCrop(null);
          }}
          onDone={async (blob) => {
            await pushImage(blob, "ad-crop.jpg");
            if (crop.src.startsWith("blob:")) URL.revokeObjectURL(crop.src);
            setCrop(null);
          }}
        />
      ) : null}
    </div>
  );
}
