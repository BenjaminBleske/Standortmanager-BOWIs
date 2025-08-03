import csv
import json

def create_czml_from_csv(csv_path, output_czml_path):
    print("Skript gestartet")
    base_czml = [{"id": "document", "version": "1.0"}]

    try:
        with open(csv_path, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile, delimiter=',')
            for row in reader:
                print(f"Verarbeite Plakat: {row['id']} mit Koordinaten: Längengrad {row['x_coord']}, Breitengrad {row['y_coord']}")
                entry = {
                    "id": row['id'],
                    "position": {
                        "cartographicDegrees": [float(row['x_coord']), float(row['y_coord']), 0]
                    },
                    "billboard": {
                        "image": "data:image/png;base64,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",
                        "verticalOrigin": "BOTTOM",
                        "heightReference": "RELATIVE_TO_GROUND",
                        "width": 50,
                        "height": 50,
                        "disableDepthTestDistance": 1000000000
                    }
                }
                base_czml.append(entry)
    except FileNotFoundError:
        print("CSV-Datei wurde nicht gefunden. Bitte überprüfen Sie den Dateipfad.")
    except Exception as e:
        print("Ein Fehler ist aufgetreten: ", str(e))

    try:
        with open(output_czml_path, 'w', encoding='utf-8') as f:
            json.dump(base_czml, f, indent=4)
        print("CZML-Datei erfolgreich geschrieben:", output_czml_path)
    except Exception as e:
        print("Fehler beim Schreiben der Datei: ", str(e))

csv_path = 'StandorteCDU.csv'
output_czml_path = 'CDU_Pins.czml'

create_czml_from_csv(csv_path, output_czml_path)
