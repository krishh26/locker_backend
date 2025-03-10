import pdfplumber
import json

def extract_clean_table(pdf_path):
    table_data = []
    current_section = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    # Clean up the row by removing unnecessary spaces and null values
                    cleaned_row = [cell.strip() if cell else '' for cell in row]
                    if any(cleaned_row):
                        # If "Title" is in the first column, start a new section
                        if "Title" in cleaned_row[0]:
                            if current_section:
                                # Append the current section to table_data
                                table_data.append(current_section)
                            # Start a new section with the current "Title" row
                            current_section = [",".join(cleaned_row)]
                        else:
                            # Otherwise, continue adding to the current section
                            current_section.append(",".join(cleaned_row))

    # Append the last section if it's not empty
    if current_section:
        table_data.append(current_section)

    return table_data

def write_to_json(data, output_path):
    # Writing the cleaned data into a structured JSON file
    with open(output_path, 'w') as json_file:
        json.dump({"table": data}, json_file, indent=4)

# Read arguments from command-line
pdf_path = "temp.pdf"
output_json_path = "temp.json"

# Extract and clean the table
cleaned_table = extract_clean_table(pdf_path)
write_to_json(cleaned_table, output_json_path)

print(f'Cleaned table data has been written to {output_json_path}')
