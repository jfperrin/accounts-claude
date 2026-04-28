import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Taille du carré de sélection à l'écran (px)
const VIEWPORT_SIZE = 280;
// Résolution finale de l'avatar exporté (px)
const OUTPUT_SIZE = 512;
// Qualité JPEG à l'export
const JPEG_QUALITY = 0.9;

// Dialogue de recadrage : reçoit un File image, affiche un cercle de sélection
// fixe ; l'utilisateur déplace l'image et zoome via le slider. À la validation,
// la zone du cercle est exportée en JPEG carré (OUTPUT_SIZE) via Canvas.
export default function AvatarCropDialog({ open, file, onConfirm, onCancel }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Charge l'image en blob URL pour l'affichage
  useEffect(() => {
    if (!file) { setImageUrl(null); return undefined; }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Une fois l'URL prête, mesure les dimensions naturelles + scale initial qui
  // fait remplir le viewport par la dimension la plus petite (≃ object-fit: cover).
  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      const initialScale = VIEWPORT_SIZE / Math.min(img.naturalWidth, img.naturalHeight);
      setScale(initialScale);
      setOffset({ x: 0, y: 0 });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Borne l'offset pour que l'image couvre toujours le viewport (pas de bandes).
  const clampOffset = (x, y, s) => {
    const halfExcessX = Math.max(0, (imgSize.w * s - VIEWPORT_SIZE) / 2);
    const halfExcessY = Math.max(0, (imgSize.h * s - VIEWPORT_SIZE) / 2);
    return {
      x: Math.max(-halfExcessX, Math.min(halfExcessX, x)),
      y: Math.max(-halfExcessY, Math.min(halfExcessY, y)),
    };
  };

  const minScale = imgSize.w && imgSize.h
    ? VIEWPORT_SIZE / Math.min(imgSize.w, imgSize.h)
    : 1;
  const maxScale = minScale * 4;

  const dragStateRef = useRef(null);

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y };
  };

  const onPointerMove = (e) => {
    const s = dragStateRef.current;
    if (!s) return;
    const newX = s.originX + (e.clientX - s.startX);
    const newY = s.originY + (e.clientY - s.startY);
    setOffset(clampOffset(newX, newY, scale));
  };

  const onPointerUp = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragStateRef.current = null;
  };

  const onScaleChange = (e) => {
    const newScale = parseFloat(e.target.value);
    setScale(newScale);
    setOffset((o) => clampOffset(o.x, o.y, newScale));
  };

  const handleConfirm = () => {
    if (!imgSize.w || !imgSize.h || !imageUrl) return;
    // Coin haut-gauche du viewport en coordonnées image (px naturels)
    const sx = imgSize.w / 2 - offset.x / scale - VIEWPORT_SIZE / (2 * scale);
    const sy = imgSize.h / 2 - offset.y / scale - VIEWPORT_SIZE / (2 * scale);
    const sw = VIEWPORT_SIZE / scale;
    const sh = VIEWPORT_SIZE / scale;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      canvas.toBlob((blob) => {
        if (!blob) return;
        // Conserve le nom d'origine mais force l'extension .jpg
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const cropped = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
        onConfirm(cropped);
      }, 'image/jpeg', JPEG_QUALITY);
    };
    img.src = imageUrl;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recadrer l'avatar</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative overflow-hidden rounded-full bg-slate-900 cursor-move select-none touch-none"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
          >
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: imgSize.w * scale,
                  height: imgSize.h * scale,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  pointerEvents: 'none',
                  maxWidth: 'none',
                }}
              />
            )}
          </div>
          {imgSize.w > 0 && (
            <input
              type="range"
              min={minScale}
              max={maxScale}
              step={(maxScale - minScale) / 100}
              value={scale}
              onChange={onScaleChange}
              className="w-full accent-indigo-600"
              aria-label="Zoom"
            />
          )}
          <p className="text-xs text-muted-foreground">
            Glissez pour repositionner, utilisez le curseur pour zoomer.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
          <Button type="button" onClick={handleConfirm} disabled={!imgSize.w}>Valider</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
