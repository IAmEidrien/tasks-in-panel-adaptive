.PHONY: check pack
check:
	python3 .github/scripts/validate.py
pack:
	python3 tools/package.py
