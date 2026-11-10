# Dev shell for Mini Wine Cellar.
# Usage: nix-shell
# Verify: nix-shell --run 'node -v && pnpm -v && psql --version'
#
# No nixpkgs pin: uses the channel already present in NIX_PATH.
# Versions below were read from the store binaries; nix-shell does not start here.
{
  pkgs ? import <nixpkgs> { },
}:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_22
    pnpm
    postgresql_17
    openssl
    curl
    git
    jq
  ];

  # Nothing is installed here; every step stays explicit.
  # DATABASE_URL and friends come from .env files, never from this hook.
  shellHook = ''
    echo "=== Mini Wine Cellar | Dev Environment ==="
    echo "node: $(node -v)"
    echo "pnpm: $(pnpm -v)"
    echo "psql: $(psql --version)"

    # Postgres runs through compose, so fix the file path once.
    export COMPOSE_FILE=docker-compose.yml

    echo ""
    echo "Next:"
    echo "  1) pnpm install   # workspace dependencies"
    echo "  2) pnpm db:up     # postgres:17 in docker compose"
    echo "  3) pnpm db:setup  # migrations + seed"
    echo "  4) pnpm dev       # api + web in parallel"
  '';
}
