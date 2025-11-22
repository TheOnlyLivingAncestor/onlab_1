// Defer-rel töltöttem be a scriptet, így a html elemek már léteznek, amikor ezt a kódot futtatom


const FUNCTION_URL = "/image_processing/easyocr-lexa";
const form = document.getElementById("detectionForm");

function encodeImageFileAsURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Hiba a fájl olvasásakor"));
        reader.readAsDataURL(file);
    });
} 

function getBase64FromDataURL(dataURL) {
    // eltávolítja a "data:*/*;base64," előtagot, törli a whitespace-t és paddol ha kell
    let b64 = dataURL.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
    while (b64.length % 4 !== 0) b64 += "=";
    return b64;
}

async function uploadImageToStorage(image) {
    const formData = new FormData();
    formData.append('image', image);

    const response = await fetch('/upload', {
        method: 'POST',
        body: formData
    });

    if(response.ok){
        console.log('Sikeres képfeltöltés!');
    } else {
        console.error('Hiba történt a kép feltöltése során!')
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault()
    const formElem = event.target;

    const image = formElem.image.files[0];
    if(!image){
        console.error("Nincs kiválasztott kép!");
        return;
    }

    try {
        await uploadImageToStorage(image)

        //OCR image feldolgozás
        //TODO: image nevet át kell adni az ocr function-nak

        const dataUrl = await encodeImageFileAsURL(image);
        const image_base64 = getBase64FromDataURL(dataUrl);
        //Az openfaas function egyenlőre csak az image-t várja
        //ezt az image-t most csak base64-ként küldjük el
        const response = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                image: image_base64
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw  new Error(`Hálózati hiba: ${response.status} - ${text}`);
        }
        const result = await response.json();
        console.log("Eredmény az OCR feldolgozásból:", result);

        let imagecontainer = document.getElementById("imageContainer");
        let resultcontainer = document.getElementById("resultContainer");
        imagecontainer.innerHTML = '';
        if (result.image){
            //Ha érkezett vissza kép, akkor megjelenítem
            imagecontainer.parentNode.style.display="flex";
            const img = document.createElement("img");
            img.src = "data:image/png;base64," + result.image;
            img.alt = "Feldolgozott kép";
            img.style.maxWidth = "100%";
            img.style.height = "auto";
            imagecontainer.appendChild(img);
        }else {
            container.textContent = "Nem érkezett vissza kép az OCR feldolgozásból.";
        }
        if (result.results){
            //Ha érkezett vissza szöveg, akkor megjelenítem
            let pre = resultcontainer.querySelector("pre");
            if (!pre) {
                pre = document.createElement("pre");
            resultcontainer.appendChild(pre);
            }
            pre.textContent = result.results.join("\n");
        }

    } catch (error) {
        console.error("Hiba a kép kódolásakor:", error);
        return;
    }
});