import cv2
import easyocr
import base64
import numpy as np
import json
import requests

reader = easyocr.Reader(['en'],download_enabled=False ,model_storage_directory="/home/app/EasyOCR/model", gpu=False)

def download_image(presigned_url):
    response = requests.get(presigned_url)
    response.raise_for_status()
    image_bytes = np.frombuffer(response.content, np.uint8)
    image = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)
    return image

def handle(event, context):
    try:
        body = event.body.decode('utf-8') if isinstance(event.body, (bytes, bytearray)) else event.body
        imageBody = json.loads(body)

        #Kép letöltése object storage-ból
        image = download_image(imageBody['getUrl'])

        #Kép dekódolása base64-ról
        #image_bytes = base64.b64decode(imageBody['image']) #b64decode byte-ket küld vissza
        #image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        #image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        #EasyOCR lefuttatása a képre
        results = reader.readtext(image, paragraph=True, slope_ths=0.4, width_ths=0.7)

        #Dobozok berajzolása
        for (boundary, _ ) in results:
            pts = np.array(boundary, dtype=np.int32)
            cv2.polylines(image, [pts], True, (0, 255, 0), 2)

        #Az annotált kép visszakonvertálása base64-ba
        buf = cv2.imencode('.jpg', image)[1]
        annotated_b64 = base64.b64encode(buf).decode('utf-8')

        #A detektált szövegek összegyűjtése
        results_json = []
        for (_, text) in results:
            results_json.append(text)

        ocr_result = {
            "image": annotated_b64,
            "results": results_json
        }
        ocr_result_json = json.dumps(ocr_result).encode('utf-8')
        response = requests.put(imageBody['putUrl'], data=ocr_result_json, headers={'Content-Type': 'application/json'})

        if response.status_code == 200:
            print("Eredmény sikeresen feltöltve.")
        else:
            print(f"Hiba a feltöltés során: {response.status_code} - {response.text}")

        return {
            "statusCode": 200,
            "body": json.dumps({
                "image": annotated_b64,
                "results": results_json
            })
        }

    except Exception as e:
        return {"statusCode": 500, "body": str(e)}