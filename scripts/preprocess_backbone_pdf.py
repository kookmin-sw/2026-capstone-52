import argparse
from pathlib import Path

from app.services.backbone_preprocess_service import preprocess_pdf_to_chunks, write_chunks_json


def main() -> None:
    parser = argparse.ArgumentParser(description="Preprocess a local backbone PDF into chunk JSON.")
    parser.add_argument("--input", required=True, help="Local input PDF path")
    parser.add_argument("--subject-id", required=True, help="Subject ID")
    parser.add_argument("--source-id", required=True, help="Source identifier")
    parser.add_argument("--source-title", default=None, help="Optional source title")
    parser.add_argument("--output", required=True, help="Output JSON path")
    parser.add_argument("--target-chars", type=int, default=1800)
    parser.add_argument("--overlap-chars", type=int, default=250)
    parser.add_argument("--max-chars", type=int, default=2600)
    args = parser.parse_args()

    input_path = Path(args.input)
    file_bytes = input_path.read_bytes()
    chunks = preprocess_pdf_to_chunks(
        file_bytes,
        subject_id=args.subject_id,
        source_id=args.source_id,
        source_title=args.source_title,
        target_chars=args.target_chars,
        overlap_chars=args.overlap_chars,
        max_chars=args.max_chars,
    )
    output_path = write_chunks_json(chunks, args.output)
    total_chars = sum(len(chunk.get("text", "")) for chunk in chunks)

    print(f"input path: {input_path}")
    print(f"output path: {output_path}")
    print(f"subject_id: {args.subject_id}")
    print(f"source_id: {args.source_id}")
    print(f"number of chunks: {len(chunks)}")
    print(f"approximate total characters: {total_chars}")


if __name__ == "__main__":
    main()
