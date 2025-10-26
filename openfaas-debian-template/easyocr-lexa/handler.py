import cv2
import easyocr
import base64
import numpy as np
import json

reader = easyocr.Reader(['en'],download_enabled=False ,model_storage_directory="/home/app/EasyOCR/model", gpu=False)

def handle(event, context):
    try:
        body = event.body.decode('utf-8') if isinstance(event.body, (bytes, bytearray)) else event.body
        imageBody = json.loads(body)
        if 'image' not in imageBody:
            raise ValueError("Nincs 'image' mező a JSON-ben")
        #Kép dekódolása
        image_bytes = base64.b64decode(imageBody['image']) #b64decode byte-ket küld vissza
        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

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

        return {
            "statusCode": 200,
            "body": json.dumps({
                "image": annotated_b64,
                "results": results_json
            })
        }

    except Exception as e:
        return {"statusCode": 500, "body": str(e)}