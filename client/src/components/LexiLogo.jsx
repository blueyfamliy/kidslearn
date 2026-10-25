// Lexi's mark, inlined rather than loaded from public/.
//
// The offline desktop build inlines all JS and CSS into one HTML file
// (VITE_SINGLEFILE) but does NOT inline files from public/ — they are emitted
// alongside it. An <img src="lexi.svg"> would therefore be a broken image in
// exactly the build the kids use most, and would also break on the GitHub Pages
// sub-path. As JSX it is part of the bundle and works everywhere: dev server,
// kidslearn.fun, the single-file HTML opened over file://, and the APK.
//
// client/public/lexi.svg is the same artwork as a standalone brand asset.
//
// Text uses currentColor so it sits on any background; the badge stays brand
// purple.

export default function LexiLogo({ width = 150, showWordmark = true, className }) {
  // The wordmark lockup is roughly square; the mark alone is a circle.
  const height = showWordmark ? width * (430 / 512) : width;
  const viewBox = showWordmark ? '0 0 512 430' : '48 42 416 216';

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={viewBox}
      role="img"
      aria-label="Lexi — מודל השפה של KidsLearn"
      style={{ flexShrink: 0 }}
    >
      <circle cx="256" cy="150" r="102" fill="#4B10F5" />

      {/* Top-down airliner, nose up-right at 45°. */}
      <g transform="translate(256 150) rotate(45) scale(1.28)">
        <path
          fill="#fff"
          d="M0,-52 C6.5,-52 10.5,-41 10.5,-28.5 L10.5,-10 L50,14.5 L50,25 L10.5,14.5
             L10.5,31 L22.5,43 L22.5,49.5 L0,43 L-22.5,49.5 L-22.5,43 L-10.5,31
             L-10.5,14.5 L-50,25 L-50,14.5 L-10.5,-10 L-10.5,-28.5
             C-10.5,-41 -6.5,-52 0,-52 Z"
        />
        <rect fill="#fff" x="-34" y="-9" width="7" height="15" rx="2" />
        <rect fill="#fff" x="27" y="-9" width="7" height="15" rx="2" />
      </g>

      {showWordmark && (
        <>
          <text
            x="256" y="330" textAnchor="middle" fill="currentColor"
            fontFamily="Georgia, 'Times New Roman', serif" fontSize="176" letterSpacing="-2"
          >
            Lexi
          </text>
          <text
            x="256" y="398" textAnchor="middle" fill="currentColor"
            fontFamily="Georgia, 'Times New Roman', serif" fontSize="52"
          >
            kidslearn model
          </text>
        </>
      )}
    </svg>
  );
}
