#!/usr/bin/env bash
#
# Avtotime backup: MongoDB dump + uploads volume archive.
#
# Designed to be run unattended from cron on the production server:
#   0 3 * * * /root/avtotime/scripts/backup.sh >> /var/log/avtotime-backup.log 2>&1
#
# Everything it produces lands under $BACKUP_DIR/<YYYY-MM-DD_HHMMSS>/ and is
# rotated automatically. The script never writes into a docker volume and never
# touches a running container beyond `docker compose exec`, so it is safe to run
# while the site is serving traffic.
#
# Overridable via environment (all have working defaults):
#   BACKUP_DIR     where archives are stored          (default <project>/backups)
#   MONGO_DB       database name                      (default avtotime)
#   KEEP_DAILY     dated directories to keep          (default 7)
#   KEEP_UPLOADS   newest dirs that keep uploads.tgz  (default 2)
#   MIN_FREE_MB    abort if less free space than this (default 2048)
#   HEALTHCHECK_URL  dead-man's-switch ping URL       (default: disabled)
#   RCLONE_REMOTE    offsite destination, e.g. b2:bucket (default: disabled)
#
set -Eeuo pipefail

# ── Locate the compose project (this script lives in <project>/scripts) ──────
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
MONGO_DB="${MONGO_DB:-avtotime}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_UPLOADS="${KEEP_UPLOADS:-2}"
MIN_FREE_MB="${MIN_FREE_MB:-2048}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

STAMP="$(date +%Y-%m-%d_%H%M%S)"
DEST="$BACKUP_DIR/$STAMP"
LOG_FILE="$BACKUP_DIR/backup.log"

# ── Logging ─────────────────────────────────────────────────────────────────
log() { printf '%s [backup] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG_FILE"; }

ping_healthcheck() {
  # $1 = "" for success, "/fail" or "/start" for the other endpoints.
  [ -n "$HEALTHCHECK_URL" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${HEALTHCHECK_URL}${1:-}" || true
}

FAILED_STEP=""
on_error() {
  log "FAILED at line $1 (last step: ${FAILED_STEP:-unknown})"
  ping_healthcheck "/fail"
}
trap 'on_error $LINENO' ERR

mkdir -p "$BACKUP_DIR"

# ── Single instance: a slow uploads tar must not overlap the next cron run ──
exec 9>"$BACKUP_DIR/.backup.lock"
if ! flock -n 9; then
  log "another backup run is still in progress — skipping"
  exit 0
fi

# ── Preflight ───────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"

if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  log "FAILED: neither 'docker compose' nor 'docker-compose' is available"
  ping_healthcheck "/fail"
  exit 1
fi

FREE_MB="$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')"
if [ "${FREE_MB:-0}" -lt "$MIN_FREE_MB" ]; then
  log "FAILED: only ${FREE_MB}MB free under $BACKUP_DIR, need ${MIN_FREE_MB}MB"
  ping_healthcheck "/fail"
  exit 1
fi

ping_healthcheck "/start"
log "start — dest=$DEST free=${FREE_MB}MB"
mkdir -p "$DEST"

# From here on the dated directory exists, so a failure would leave a husk that
# rotation counts as a real snapshot — seven bad nights in a row would evict the
# last good backup. Remove it unless the run reaches the end.
COMPLETE=0
UPLOADS_OK=0
cleanup() {
  if [ "$COMPLETE" -ne 1 ]; then
    rm -rf -- "$DEST"
    log "incomplete run — removed $DEST so rotation cannot mistake it for a snapshot"
  fi
}
trap cleanup EXIT

# ── 1. MongoDB ──────────────────────────────────────────────────────────────
# `exec -T` keeps stdout a raw binary pipe (no TTY translation), which is what
# makes streaming the gzip archive straight out of the container safe.
FAILED_STEP="mongo-preflight"
MONGO_FILE="$DEST/mongo-$MONGO_DB.archive.gz"

# mongodump of a database that does not exist still exits 0 and writes a valid,
# tiny gzip stream, so neither the `-s` test nor `gzip -t` below can tell a real
# backup from a typo in MONGO_DB. Ask the server whether it is actually there.
MONGO_CID="$("${DC[@]}" ps -aq mongodb || true)"
if [ -z "$MONGO_CID" ]; then
  log "FAILED: no mongodb container in this compose project"
  ping_healthcheck "/fail"
  exit 1
fi

COLLECTIONS="$("${DC[@]}" exec -T mongodb mongosh --quiet --eval "db.getSiblingDB('$MONGO_DB').getCollectionNames().length" 2>/dev/null | tail -n 1 | tr -dc '0-9')"
if [ -z "$COLLECTIONS" ] || [ "$COLLECTIONS" -eq 0 ]; then
  log "FAILED: database '$MONGO_DB' reports ${COLLECTIONS:-no} collections - refusing to store an empty backup"
  ping_healthcheck "/fail"
  exit 1
fi
log "database '$MONGO_DB' has $COLLECTIONS collection(s)"

# Dumped from a SEPARATE container rather than via `exec` into mongodb: `exec`
# joins the target's cgroup, so the dump's memory would be charged against the
# database's own mem_limit. Once the dataset grows the kernel would pick the
# largest RSS in that cgroup - mongod itself - and the nightly backup would
# take production down at 03:20.
FAILED_STEP="mongodump"
MONGO_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$MONGO_CID")"
MONGO_NET="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$MONGO_CID" | awk '{print $1}')"
docker run --rm --network "$MONGO_NET" "$MONGO_IMAGE" mongodump --host=mongodb --db="$MONGO_DB" --archive --gzip --quiet > "$MONGO_FILE"

if [ ! -s "$MONGO_FILE" ]; then
  log "FAILED: mongo dump is empty"
  ping_healthcheck "/fail"
  exit 1
fi
# Catches a truncated stream: a half-written archive still looks like a file.
gzip -t "$MONGO_FILE"
log "mongo dump ok ($(du -h "$MONGO_FILE" | cut -f1))"

# ── 2. Uploads volume ───────────────────────────────────────────────────────
# The volume name is derived from the compose project name, so read it off the
# running backend container instead of hardcoding "avtotime_uploads".
FAILED_STEP="uploads"
# `ps -q` lists only RUNNING containers, and the backend is legitimately down
# during every CI deploy and for a minute after a reboot. `-a` keeps the volume
# name discoverable then, because docker inspect works on a stopped container.
BACKEND_CID="$("${DC[@]}" ps -aq backend || true)"
UPLOADS_VOL=""
if [ -n "$BACKEND_CID" ]; then
  UPLOADS_VOL="$(docker inspect -f \
    '{{range .Mounts}}{{if eq .Destination "/app/public"}}{{.Name}}{{end}}{{end}}' \
    "$BACKEND_CID")"
fi

if [ -z "$UPLOADS_VOL" ]; then
  log "WARNING: uploads volume not found (backend container down?) — skipping file backup"
else
  UPLOADS_FILE="$DEST/uploads.tar.gz"
  docker run --rm \
    -v "$UPLOADS_VOL":/data:ro \
    -v "$DEST":/backup \
    alpine:3.20 \
    tar -czf /backup/uploads.tar.gz -C /data .
  gzip -t "$UPLOADS_FILE"
  UPLOADS_OK=1
  log "uploads archive ok ($(du -h "$UPLOADS_FILE" | cut -f1), volume=$UPLOADS_VOL)"
fi

# ── 3. Manifest ─────────────────────────────────────────────────────────────
FAILED_STEP="manifest"
{
  echo "created:      $(date -Is)"
  echo "host:         $(hostname)"
  echo "project_dir:  $PROJECT_DIR"
  echo "mongo_db:     $MONGO_DB"
  echo "uploads_vol:  ${UPLOADS_VOL:-<skipped>}"
  echo
  echo "restore:      see BACKUP.md next to this script's project root"
} > "$DEST/MANIFEST.txt"

# ── 4. Rotation ─────────────────────────────────────────────────────────────
# Dated directory names sort chronologically, so plain reverse sort is enough —
# no reliance on mtime, which a copy or an rsync would reset.
FAILED_STEP="rotation"
mapfile -t SNAPSHOTS < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d \
  -name '20*_*' -printf '%f\n' | sort -r)

for i in "${!SNAPSHOTS[@]}"; do
  snap="$BACKUP_DIR/${SNAPSHOTS[$i]}"
  if [ "$i" -ge "$KEEP_DAILY" ]; then
    rm -rf -- "$snap"
    log "rotated out $snap"
  elif [ "$i" -ge "$KEEP_UPLOADS" ] && [ -f "$snap/uploads.tar.gz" ]; then
    # Uploads are large and change slowly; only the newest few snapshots keep
    # the media tarball, the older ones stay as database-only restore points.
    rm -f -- "$snap/uploads.tar.gz"
    log "dropped uploads tarball from $snap"
  fi
done

COMPLETE=1
TOTAL="$(du -sh "$BACKUP_DIR" | cut -f1)"

if [ "$UPLOADS_OK" -ne 1 ]; then
  # The uploads volume holds essentially all the real data; a snapshot without
  # it is not a backup. Pinging success here would keep the dead-man's switch
  # quiet precisely when it should be shouting.
  log "INCOMPLETE — snapshot $STAMP has the database but NOT the uploads volume"
  ping_healthcheck "/fail"
  exit 1
fi

# ── 5. Offsite copy ─────────────────────────────────────────────────────────
# A backup sitting on the same disk as the database does not survive the failure
# it exists for. Placed AFTER COMPLETE=1 on purpose: a failed upload still leaves
# the local snapshot in place, because that is worth keeping either way — but it
# must not report success, since "backed up" and "backed up only on the machine
# that might die" are different claims.
FAILED_STEP="offsite"
if [ -n "$RCLONE_REMOTE" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    log "FAILED: RCLONE_REMOTE is set but rclone is not installed"
    ping_healthcheck "/fail"
    exit 1
  fi
  # The lock file and the running log are local bookkeeping, not backup content.
  if rclone sync "$BACKUP_DIR" "$RCLONE_REMOTE" --transfers 2 --checksum --exclude ".backup.lock" --exclude "backup.log"; then
    log "offsite sync ok -> $RCLONE_REMOTE"
  else
    log "FAILED: offsite sync to $RCLONE_REMOTE did not complete"
    ping_healthcheck "/fail"
    exit 1
  fi
else
  log "offsite: RCLONE_REMOTE not set — snapshots exist only on this disk"
fi

log "done — snapshot $STAMP complete, $BACKUP_DIR now $TOTAL"
ping_healthcheck ""
