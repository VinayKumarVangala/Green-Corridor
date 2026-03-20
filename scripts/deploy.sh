#!/usr/bin/env bash
# scripts/deploy.sh — JEEVAN-SETU deployment script
set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
APP_NAME="jeevan-setu"
REQUIRED_SECRETS=(
  "next_public_supabase_url"
  "next_public_supabase_anon_key"
  "supabase_service_role_key"
  "nextauth_secret"
  "nextauth_url"
)
REQUIRED_NODE_VERSION="18"

# ─── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ─── Parse args ───────────────────────────────────────────────────────────────
ENV="${1:-production}"   # production | preview | development
[[ "$ENV" =~ ^(production|preview|development)$ ]] || error "Usage: $0 [production|preview|development]"
info "Target environment: $ENV"

# ─── 1. Node version check ────────────────────────────────────────────────────
CURRENT_NODE=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
[[ "$CURRENT_NODE" -ge "$REQUIRED_NODE_VERSION" ]] \
  || error "Node.js $REQUIRED_NODE_VERSION+ required (found v$CURRENT_NODE)"
success "Node.js v$CURRENT_NODE"

# ─── 2. Vercel CLI check ──────────────────────────────────────────────────────
command -v vercel &>/dev/null || error "Vercel CLI not found. Run: npm i -g vercel"
success "Vercel CLI $(vercel --version 2>/dev/null | head -1)"

# ─── 3. Verify Vercel secrets exist ──────────────────────────────────────────
info "Checking Vercel secrets..."
MISSING_SECRETS=()
for secret in "${REQUIRED_SECRETS[@]}"; do
  if ! vercel env ls 2>/dev/null | grep -q "$secret"; then
    MISSING_SECRETS+=("$secret")
  fi
done

if [[ ${#MISSING_SECRETS[@]} -gt 0 ]]; then
  warn "Missing Vercel secrets — adding interactively:"
  for secret in "${MISSING_SECRETS[@]}"; do
    echo -e "  ${YELLOW}→${NC} $secret"
    vercel env add "$secret" "$ENV"
  done
fi
success "All secrets verified"

# ─── 4. Install dependencies ──────────────────────────────────────────────────
info "Installing dependencies..."
npm install --legacy-peer-deps --silent
success "Dependencies installed"

# ─── 5. Type-check ────────────────────────────────────────────────────────────
info "Running type check..."
npx tsc --noEmit 2>&1 | tail -5 || warn "Type errors found — review before production deploy"

# ─── 6. Lint ──────────────────────────────────────────────────────────────────
info "Running lint..."
npm run lint --silent || warn "Lint warnings found"

# ─── 7. Build ─────────────────────────────────────────────────────────────────
info "Building Next.js app..."
npm run build
success "Build complete"

# ─── 8. Deploy ────────────────────────────────────────────────────────────────
info "Deploying to Vercel ($ENV)..."
if [[ "$ENV" == "production" ]]; then
  DEPLOY_URL=$(vercel deploy --prod --yes 2>&1 | tail -1)
else
  DEPLOY_URL=$(vercel deploy --yes 2>&1 | tail -1)
fi
success "Deployed: $DEPLOY_URL"

# ─── 9. Post-deploy verification ─────────────────────────────────────────────
info "Running post-deploy verification..."
sleep 5  # allow cold start
node scripts/verify-deploy.js "$DEPLOY_URL" || warn "Some verification checks failed — review output above"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ $APP_NAME deployed successfully${NC}"
echo -e "${GREEN}  URL: $DEPLOY_URL${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
