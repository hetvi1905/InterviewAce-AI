import pdfplumber

def parse_pdf(file_path):
    """
    Parses a PDF file and extracts text from all pages.
    """
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
    except Exception as e:
        print(f"Error parsing PDF: {e}")
        raise e
    return text.strip()
