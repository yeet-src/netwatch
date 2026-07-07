# Build the yeet script project.
#
#   make         — bundle the JS entry (default)
#   make bundle  — bundle the JS entry with esbuild
#   make postgen — finalize a freshly generated project (git init)
#   make clean   — remove build artifacts
#
# netwatch is a pure-JS yeet script: no BPF, no C toolchain. The only build
# step is esbuild bundling src/main.jsx into src/index.jsx (the entry the
# runtime prefers). esbuild comes from the static toolchain resolved by
# build/toolchain.mk (a shared per-machine cache), so the build needs no
# system node/npm.

.DEFAULT_GOAL := all

include build/toolchain.mk

all: bundle

# Bundle the entry with the vendored esbuild. esbuild honors tsconfig `paths`
# (so `@/` resolves at bundle time), while `yeet:*` builtins stay external. The
# bundle is written to src/index.jsx, which the entry ladder prefers over
# src/main.jsx — so once built, that is what runs. The .jsx extension keeps the
# bundle eligible for component auto-mount.
#
# The build needs no npm/node: the script imports only `yeet:*` builtins and
# local `@/` modules, which esbuild resolves on its own. If you add third-party
# packages to package.json, install them into node_modules with the package
# manager of your choice — esbuild inlines whatever it finds there.
ESBUILD_FLAGS := --bundle --format=esm --platform=neutral \
	--main-fields=module,main --conditions=import,module \
	--define:import.meta.main=false \
	--outfile=src/index.jsx --jsx=automatic --jsx-import-source=yeet:tui

bundle: | vendored-esbuild
	$(ESBUILD) src/main.jsx $(ESBUILD_FLAGS) '--external:yeet:*'

# Post-generation finalize: initialize a git repository with the vendored git
# (fetched via `vendored-git`). Idempotent — skipped if this is already a repo.
postgen: | vendored-git
	@g="$(GIT)"; [ -x "$$g" ] || g="$$(command -v git 2>/dev/null || true)"; \
	if [ -e .git ]; then \
		echo "postgen: already a git repository"; \
	elif [ -n "$$g" ]; then \
		echo "postgen: git init"; \
		"$$g" -c init.templateDir= init -q . || echo "warning: 'git init' failed" >&2; \
	else \
		echo "warning: no git available (vendored or host); skipping 'git init'" >&2; \
	fi

clean:
	rm -rf node_modules src/index.jsx

.PHONY: all bundle clean postgen
