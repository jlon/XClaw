.DEFAULT_GOAL := help

PNPM := corepack pnpm

.PHONY: help package package-mac package-mac-adhoc package-mac-local package-win package-win-all package-linux release

help:
	@printf '%s\n' \
		'XClaw packaging shortcuts' \
		'  make package           -> corepack pnpm run package' \
		'  make package-mac       -> corepack pnpm run package:mac' \
		'  make package-mac-adhoc -> corepack pnpm run package:mac:adhoc' \
		'  make package-mac-local -> corepack pnpm run package:mac:local' \
		'  make package-win       -> corepack pnpm run package:win:x64' \
		'  make package-win-all   -> corepack pnpm run package:win' \
		'  make package-linux     -> corepack pnpm run package:linux' \
		'  make release           -> corepack pnpm run release'

package:
	$(PNPM) run package

package-mac:
	$(PNPM) run package:mac

package-mac-adhoc:
	$(PNPM) run package:mac:adhoc

package-mac-local:
	$(PNPM) run package:mac:local

package-win:
	$(PNPM) run package:win:x64

package-win-all:
	$(PNPM) run package:win

package-linux:
	$(PNPM) run package:linux

release:
	$(PNPM) run release
