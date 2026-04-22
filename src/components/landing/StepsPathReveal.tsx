"use client";

import { useEffect } from "react";

/**
 * Effet de dévoilement progressif du chemin SVG (section "Comment ça
 * fonctionne"). On masque le bas du SVG via un linear-gradient
 * mask-image qui remonte au fur et à mesure que l'utilisateur scroll.
 *
 * Composant sans rendu — se contente de s'attacher au DOM existant.
 * Doit être monté une fois sur la landing.
 */
export default function StepsPathReveal() {
  useEffect(() => {
    const section = document.getElementById("how-it-works");
    if (!section) return;
    // Le wrapper desktop a un data-attribute dédié ; le wrapper mobile
    // n'en a pas. Ça évite les soucis d'échappement des `:` de Tailwind
    // (`sm:hidden`) dans un sélecteur CSS.
    const pathImg = section.querySelector<HTMLImageElement>(
      "[data-steps-path='desktop'] img",
    );
    if (!pathImg) return;

    let ticking = false;
    function updatePath() {
      if (!section || !pathImg) return;
      const rect = section.getBoundingClientRect();
      const windowH = window.innerHeight;
      const start = windowH * 0.2;
      const end = -rect.height * 0.5;
      const progress = Math.min(
        100,
        Math.max(0, ((start - rect.top) / (start - end)) * 100),
      );
      const fade = Math.min(progress + 8, 100);
      const mask = `linear-gradient(to bottom, black ${progress}%, transparent ${fade}%)`;
      pathImg.style.webkitMaskImage = mask;
      pathImg.style.maskImage = mask;
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(updatePath);
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    updatePath();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
