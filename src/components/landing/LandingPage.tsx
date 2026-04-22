import Link from "next/link";
import StepsPathReveal from "./StepsPathReveal";

/* eslint-disable @next/next/no-img-element */

/**
 * Landing page publique — rendue sur `/` pour les visiteurs non connectés.
 *
 * Les couleurs sont en inline style pour éviter de reposer sur des
 * classes Tailwind arbitraires non générées (la palette landing vit
 * dans `@theme inline` mais n'est pas encore utilisée ailleurs).
 *
 * L'effet de scroll sur le chemin SVG est délégué à `<StepsPathReveal />`.
 */
// Styles inline pour les markers (shapes) et les positions des 4 étapes
// sur desktop. Inline style garantit que ça s'applique indépendamment
// de la cascade Tailwind / preflight.
const markerStyle: React.CSSProperties = {
  width: 90,
  height: 90,
  objectFit: "contain",
  flexShrink: 0,
};

type StepPos = "top-right" | "mid-left" | "mid-right" | "bottom-left";
function stepDesktopPos(pos: StepPos): React.CSSProperties {
  // Pourcentages calés sur le chemin SVG 800×800 (S-curve).
  // La classe `sm:absolute` active le position:absolute ; sur mobile
  // ça reste static et ces valeurs sont ignorées par le browser.
  switch (pos) {
    case "top-right":    return { top: "-5%", left: "24%" };
    case "mid-left":     return { top: "26%", right: "23%", left: "auto" };
    case "mid-right":    return { top: "60%", left: "23%" };
    case "bottom-left":  return { top: "94%", right: "24%", left: "auto" };
  }
}

export default function LandingPage() {
  // Le formulaire Tally sert de point d'entrée pour les demandes de
  // devis rapides (pas de création de compte). L'inscription classique
  // pointe vers /signup pour le flow standard.
  const TALLY_QUOTE = "https://tally.so/r/wgMrXd";

  return (
    <main
      className="landing-root"
      style={{ backgroundColor: "#FAF7F2", color: "#1A3A52" }}
    >
      {/* ========== HEADER ========== */}
      <header
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm"
        style={{ backgroundColor: "rgba(255,255,255,0.95)" }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex items-center gap-3">
              <img
                src="/images/landing/logo-republique.png"
                alt="République Française"
                className="h-8 md:h-10 w-auto"
              />
              <div className="w-px h-7 md:h-8" style={{ backgroundColor: "rgba(26,58,82,0.2)" }} />
              <img
                src="/images/landing/logo-traiteurs-engages.png"
                alt="Les traiteurs engagés"
                className="h-7 md:h-8 w-auto"
              />
            </div>
            <nav className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:inline text-sm font-bold text-[#1A3A52] hover:opacity-70 transition-opacity"
              >
                Se connecter
              </Link>
              <Link href="/signup">
                <button
                  className="relative w-40 h-9 rounded-full overflow-hidden group cursor-pointer font-bold text-xs text-white"
                  style={{ backgroundColor: "#1A3A52" }}
                >
                  <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-full">
                    S&apos;inscrire
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center translate-y-full transition-transform duration-300 group-hover:translate-y-0">
                    C&apos;est parti !
                  </span>
                </button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section id="hero" className="pt-20 md:pt-24 pb-10 md:pb-16" style={{ backgroundColor: "#FAF7F2" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="flex-1 text-center lg:text-left lg:pt-12">
              <h1 className="font-fraunces text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
                Des traiteurs<br />
                <span className="font-fraunces-italic italic" style={{ color: "#B70102" }}>
                  engagés
                </span>{" "}
                pour<br />
                vos événements
              </h1>
              <p className="text-sm md:text-base mb-6 max-w-md mx-auto lg:mx-0" style={{ color: "rgba(0,0,0,0.7)" }}>
                Facilitez vos prestations traiteurs, renforcez vos achats inclusifs.
              </p>
              <a href={TALLY_QUOTE}>
                <button
                  className="relative w-64 h-12 text-white rounded-full overflow-hidden group cursor-pointer font-bold text-sm"
                  style={{ backgroundColor: "#1A3A52" }}
                >
                  <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-full">
                    Faire une demande de devis
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center translate-y-full transition-transform duration-300 group-hover:translate-y-0">
                    C&apos;est parti !
                  </span>
                </button>
              </a>

              <div className="flex justify-center lg:justify-start gap-6 md:gap-10 mt-8 md:mt-10">
                <div className="text-center lg:text-left">
                  <p className="font-fraunces text-2xl md:text-3xl font-bold" style={{ color: "#1A3A52" }}>
                    61
                  </p>
                  <p className="text-[11px] md:text-xs mt-1 max-w-[120px]" style={{ color: "#1A3A52" }}>
                    Traiteurs inclusifs référencés en Île-de-France
                  </p>
                </div>
                <div className="text-center lg:text-left">
                  <p className="font-fraunces text-2xl md:text-3xl font-bold" style={{ color: "#1A3A52" }}>
                    350+
                  </p>
                  <p className="text-[11px] md:text-xs mt-1" style={{ color: "#1A3A52" }}>
                    Événements réalisés
                  </p>
                </div>
                <div className="text-center lg:text-left">
                  <p className="font-fraunces text-2xl md:text-3xl font-bold" style={{ color: "#1A3A52" }}>
                    89%
                  </p>
                  <p className="text-[11px] md:text-xs mt-1" style={{ color: "#1A3A52" }}>
                    D&apos;utilisateurs satisfaits
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 flex justify-center lg:justify-end">
              <img
                src="/images/landing/Hero_image.png"
                alt="Traiteurs engagés - prestations événementielles"
                className="w-full max-w-sm lg:max-w-md xl:max-w-lg h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ========== COMMENT ÇA FONCTIONNE ========== */}
      <section id="how-it-works" className="pt-8 pb-12 md:pt-16 md:pb-32" style={{ backgroundColor: "#FAF7F2" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="font-fraunces text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">
              <span className="title-deco">Comment ça fonctionne ?</span>
            </h2>
            <p className="text-sm md:text-base max-w-xl mx-auto md:pb-16" style={{ color: "rgba(0,0,0,0.6)" }}>
              Un processus simple et efficace pour trouver le traiteur idéal pour votre événement
            </p>
          </div>

          {/* Grille des étapes — version robuste en Tailwind pur, sans
              dépendance à du CSS custom qui pourrait ne pas s'appliquer.
              Desktop : 4 étapes absolument positionnées sur un conteneur
              600×600 avec le chemin SVG en arrière-plan.
              Mobile  : stack vertical centré. */}
          <div className="relative w-full max-w-[600px] mx-auto">
            {/* Chemin SVG (desktop uniquement) */}
            <div
              className="hidden sm:block absolute inset-0 pointer-events-none"
              data-steps-path="desktop"
            >
              <img
                src="/images/landing/chemin-desktop.svg"
                alt=""
                aria-hidden="true"
                className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-auto"
              />
            </div>

            {/* Container qui donne la hauteur 800×800 sur desktop, auto sur mobile */}
            <div className="relative z-10 flex flex-col gap-10 sm:block sm:aspect-[1/1]">
              {/* Step 1 — top, droite */}
              <div
                className="flex flex-col items-center text-center gap-3 sm:flex-row sm:items-start sm:text-left sm:gap-3 sm:absolute"
                style={stepDesktopPos("top-right")}
              >
                <img
                  src="/images/landing/shape-mushroom.png"
                  alt=""
                  aria-hidden="true"
                  style={markerStyle}
                />
                <div className="max-w-[260px] sm:max-w-[200px]">
                  <h3 className="font-fraunces text-base sm:text-lg font-bold mb-1">
                    1. Inscrivez-vous
                  </h3>
                  <p className="text-xs sm:text-sm" style={{ color: "rgba(0,0,0,0.6)" }}>
                    Créez un compte pour votre organisation &amp; rattachez autant d&apos;utilisateurs que vous le souhaitez
                  </p>
                </div>
              </div>

              {/* Step 2 — milieu-haut, gauche */}
              <div
                className="flex flex-col items-center text-center gap-3 sm:flex-row-reverse sm:items-start sm:text-right sm:gap-3 sm:absolute"
                style={stepDesktopPos("mid-left")}
              >
                <img
                  src="/images/landing/shape-star-pink.png"
                  alt=""
                  aria-hidden="true"
                  style={markerStyle}
                />
                <div className="max-w-[260px] sm:max-w-[200px]">
                  <h3 className="font-fraunces text-base sm:text-lg font-bold mb-1">
                    2. Déposez votre demande de devis
                  </h3>
                  <p className="text-xs sm:text-sm" style={{ color: "rgba(0,0,0,0.6)" }}>
                    Type d&apos;événement, nombre de convives, date, lieu : nous qualifions votre demande !
                  </p>
                </div>
              </div>

              {/* Step 3 — milieu-bas, droite */}
              <div
                className="flex flex-col items-center text-center gap-3 sm:flex-row sm:items-start sm:text-left sm:gap-3 sm:absolute"
                style={stepDesktopPos("mid-right")}
              >
                <img
                  src="/images/landing/shape-butterfly.png"
                  alt=""
                  aria-hidden="true"
                  style={markerStyle}
                />
                <div className="max-w-[260px] sm:max-w-[200px]">
                  <h3 className="font-fraunces text-base sm:text-lg font-bold mb-1">
                    3. Recevez 3 devis
                  </h3>
                  <p className="text-xs sm:text-sm" style={{ color: "rgba(0,0,0,0.6)" }}>
                    Les traiteurs les plus adaptés vous envoient leurs propositions personnalisées
                  </p>
                </div>
              </div>

              {/* Step 4 — bas, gauche */}
              <div
                className="flex flex-col items-center text-center gap-3 sm:flex-row-reverse sm:items-start sm:text-right sm:gap-3 sm:absolute"
                style={stepDesktopPos("bottom-left")}
              >
                <img
                  src="/images/landing/shape-scallop-pink.png"
                  alt=""
                  aria-hidden="true"
                  style={markerStyle}
                />
                <div className="max-w-[260px] sm:max-w-[200px]">
                  <h3 className="font-fraunces text-base sm:text-lg font-bold mb-1">
                    4. Choisissez et<br />c&apos;est parti !
                  </h3>
                  <p className="text-xs sm:text-sm" style={{ color: "rgba(0,0,0,0.6)" }}>
                    Comparez, échangez et validez votre choix en toute simplicité
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== BIENTÔT DISPONIBLE ========== */}
      <section id="coming-soon" className="py-12 md:py-20 relative" style={{ backgroundColor: "#1A3A52" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-10 md:mb-14">
            <span className="badge-launch mb-5 inline-block">Lancement avril 2026</span>
            <h2 className="font-fraunces text-2xl sm:text-3xl lg:text-4xl font-bold text-white mt-3 mb-3">
              Bientôt disponible
            </h2>
            <p className="text-sm md:text-base text-white max-w-2xl mx-auto">
              Une plateforme complète pensée pour simplifier la gestion de vos événements traiteurs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3 justify-center">
                <img src="/images/landing/arrow-1.png" alt="" aria-hidden="true" className="w-6 h-6 rotate-180" />
                <span className="font-fraunces text-white text-base font-bold italic mb-4">Messagerie</span>
              </div>
              <img
                src="/images/landing/screenshots/screenshot-messagerie.png"
                alt="Aperçu de la messagerie interne"
                className="w-full h-auto shadow-lg"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-3 justify-center md:order-2 md:mt-3">
                <span className="font-fraunces text-white text-base font-bold italic mb-4">
                  Demande de devis sur-mesure
                </span>
                <img
                  src="/images/landing/arrow-1.png"
                  alt=""
                  aria-hidden="true"
                  className="w-6 h-6 -scale-y-100 md:scale-y-100 md:mb-9"
                />
              </div>
              <img
                src="/images/landing/screenshots/screenshot-demande.png"
                alt="Aperçu de la demande de devis sur-mesure"
                className="w-full h-auto shadow-lg md:order-1"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3 justify-center">
                <span className="font-fraunces text-white text-base font-bold italic mb-4">Catalogue traiteur</span>
                <img src="/images/landing/arrow-2.png" alt="" aria-hidden="true" className="w-10 h-6" />
              </div>
              <img
                src="/images/landing/screenshots/screenshot-catalogue.png"
                alt="Aperçu du catalogue traiteur"
                className="w-full h-auto shadow-lg"
              />
            </div>
          </div>

          <div className="text-center">
            <Link href="/signup">
              <button
                className="relative w-64 h-12 bg-white rounded-full overflow-hidden group cursor-pointer font-bold text-sm"
                style={{ color: "#B70102" }}
              >
                <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-full">
                  S&apos;inscrire
                </span>
                <span className="absolute inset-0 flex items-center justify-center translate-y-full transition-transform duration-300 group-hover:translate-y-0">
                  C&apos;est parti
                </span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== PLATEFORME DE L'INCLUSION ========== */}
      <section id="inclusion" className="py-14 md:py-32" style={{ backgroundColor: "#FAF7F2" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="flex-1 text-center lg:text-left">
              <h2 className="font-fraunces text-xl sm:text-2xl lg:text-3xl font-bold text-black mb-4">
                <span className="title-deco">
                  Un projet porté par la<br />
                  Plateforme de l&apos;inclusion
                </span>
              </h2>
              <p className="text-sm md:text-base text-black leading-relaxed">
                Les traiteurs engagés est un produit né d&apos;une ambition : rendre l&apos;inclusion accessible à toutes
                les entreprises à travers leurs choix de restauration !
              </p>
              <p className="text-sm md:text-base text-black leading-relaxed mt-3">
                Porté par la Plateforme de l&apos;inclusion, ce projet connecte les entreprises avec des structures
                inclusives (SIAE, ESAT et EA) qui emploient des personnes éloignées de l&apos;emploi.
              </p>
            </div>
            <div className="flex-shrink-0">
              <img
                src="/images/landing/logo-plateforme-inclusion.png"
                alt="Plateforme de l'inclusion"
                className="w-56 md:w-64 lg:w-72 h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ========== CTA FINAL ========== */}
      <section id="cta-final" className="py-12 md:py-20 relative overflow-hidden" style={{ backgroundColor: "#FFDDDD" }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2
            className="font-fraunces text-xl sm:text-2xl lg:text-3xl font-bold leading-tight mb-4"
            style={{ color: "#B70102" }}
          >
            Vous pouvez dès à présent faire appel aux traiteurs engagés !
          </h2>
          <p className="text-sm md:text-base mb-8" style={{ color: "#B70102" }}>
            Demandez un devis en quelques minutes &amp; recevez jusqu&apos;à 3 devis.
          </p>
          <a href={TALLY_QUOTE}>
            <button
              className="inline-block relative w-64 h-12 rounded-full overflow-hidden group cursor-pointer font-bold text-sm"
              style={{ border: "2px solid #B70102", color: "#B70102" }}
            >
              <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-full">
                Faire une demande de devis
              </span>
              <span className="absolute inset-0 flex items-center justify-center translate-y-full transition-transform duration-300 group-hover:translate-y-0">
                C&apos;est parti !
              </span>
            </button>
          </a>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-8 md:py-10" style={{ backgroundColor: "#1A3A52" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            <div>
              <img
                src="/images/landing/logo-traiteurs-engages-white.png"
                alt="Les traiteurs engagés"
                className="h-9 w-auto"
              />
            </div>
            <nav
              className="flex flex-col md:flex-row items-center gap-2 md:gap-5 text-xs"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              <a href={TALLY_QUOTE} target="_blank" rel="noopener">
                Faire une demande de devis
              </a>
              <Link href="/signup">S&apos;inscrire</Link>
              <Link href="/login">Espace connecté</Link>
              <a href="#">CGU/CGV</a>
              <a href="#">Mentions légales</a>
            </nav>
          </div>
        </div>
      </footer>

      {/* Effet de dévoilement du chemin SVG au scroll */}
      <StepsPathReveal />
    </main>
  );
}
