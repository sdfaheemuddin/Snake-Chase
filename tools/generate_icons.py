"""Build Android PNG icons from the checked-in SVG sources."""
from pathlib import Path

try:
    import cairosvg
except ImportError as exc:
    raise SystemExit("Install CairoSVG first: python -m pip install cairosvg") from exc

ASSETS = Path(__file__).resolve().parent.parent / "assets"
ICONS = (
    ("favicon.svg", "icon-192.png", 192),
    ("favicon.svg", "icon-512.png", 512),
    ("favicon.svg", "apple-touch-icon.png", 180),
    ("icon-maskable.svg", "icon-maskable-512.png", 512),
)


def main():
    for source, destination, size in ICONS:
        input_path = ASSETS / source
        output_path = ASSETS / destination
        if not input_path.is_file():
            raise FileNotFoundError(f"Missing icon source: {input_path}")
        cairosvg.svg2png(url=str(input_path), write_to=str(output_path), output_width=size, output_height=size)
        print(f"Generated {output_path.name} ({size}x{size})")


if __name__ == "__main__":
    main()
