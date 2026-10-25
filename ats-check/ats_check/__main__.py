"""python -m ats_check cv.pdf [more.pdf ...] [--json] [--text]"""

import argparse
import json
import sys

from .checks import report


def show(r, with_text):
    print(f"{r['file']}")
    print(f"  Score: {r['score']}/100")
    print(f"  Pages: {r['pages']}   Columns: {r['columns']}")
    print(f"  Sections found: {', '.join(r['sections']) or 'none'}")
    print(f"  Email: {r['contact']['email'] or 'not found'}   Phone: {r['contact']['phone'] or 'not found'}")
    if r["findings"]:
        print("  What goes wrong:")
        for f in r["findings"]:
            cost = f"-{f['cost']}" if f["cost"] else "  "
            print(f"    {cost:>4}  {f['message']}")
    else:
        print("  Nothing found that a parser would trip on.")
    if with_text:
        print("\n  What a parser reads, line by line across the page:\n")
        print("\n".join(f"    {line}" for line in r["naive_text"].splitlines()) or "    (nothing)")
    print()


def main(argv=None):
    ap = argparse.ArgumentParser(prog="ats_check", description="Shows what an applicant tracking system reads from a CV.")
    ap.add_argument("pdf", nargs="+")
    ap.add_argument("--json", action="store_true", help="print the full result as JSON")
    ap.add_argument("--text", action="store_true", help="also print the text a parser reads")
    args = ap.parse_args(argv)
    results = [report(p) for p in args.pdf]
    if args.json:
        json.dump(results if len(results) > 1 else results[0], sys.stdout, indent=2)
        print()
    else:
        for r in results:
            show(r, args.text)


if __name__ == "__main__":
    main()
