const express = require("express");
const Minio = require("minio");
const multer = require("multer");
const { promisify } = require("util");
const fs = require('fs').promises;
const app = express();
const uploadImageToStorage = multer({ storage: multer.memoryStorage() });

app.use(express.json());

const results = {};

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ROOT_USER,
    secretKey: process.env.MINIO_ROOT_PASSWORD,
});

//MinIO metódusai callback-esek, és hogy olvasható legyen a kód, promisify-val átírjuk őket
const presignedGetObjectAsync = promisify(minioClient.presignedGetObject.bind(minioClient));
const presignedPutObjectAsync = promisify(minioClient.presignedPutObject.bind(minioClient));
const fGetObjectAsync = promisify(minioClient.fGetObject.bind(minioClient));

async function generatePresignedUrls(bucket, imageName, resultImageName, expirySeconds = 600){
    try {
        const getUrl = await presignedGetObjectAsync(bucket, imageName, expirySeconds);
        const putUrl = await presignedPutObjectAsync(bucket, resultImageName, expirySeconds);
        return {
            imageUrl: getUrl,
            uploadUrl: putUrl
        }
    } catch(err) {
        throw err;
    }
}

async function downloadFile(bucket, object, filePath){
    try {
        await fGetObjectAsync(bucket, object, filePath);
        console.log(`A fájl letöltése sikeres volt a ${filePath} helyre.`);
    } catch(err) {
        console.error('Hiba történt a fájl letöltése során: ', err);
        throw err;
    }
}

async function readJsonFile(filePath){
    try {
        const jsonData = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(jsonData);
        return data;
    } catch(err){
        console.error('Hiba a fájl beolvasása során: ', err);
    }
}

app.post('/process', uploadImageToStorage.single('image'), async (req, res) => {
    try {
    // A kép feltöltése object storage-ba
        if(!req.file){
            return res.status(400).send('Nem érkezett fájl.');
        }
        const { v4: uuidv4} = await import('uuid');

        const fileBuffer = req.file.buffer;
        const extension = req.file.originalname.split('.').pop();
        const fileId = uuidv4();
        const fileName = `${fileId}.${extension}`;
        console.log("Fájl feltöltése a következő filename-val: " + fileName);

        await minioClient.putObject(process.env.STORAGE_BUCKET_NAME, fileName, fileBuffer);
        const resultFileName = `${fileId}-result.json`;
        const urls = await generatePresignedUrls(process.env.STORAGE_BUCKET_NAME, fileName,resultFileName)

    //A két url elküldése az ocr function-nak OCR elemzésre
        const FUNCTION_URL=`${process.env.OPENFAAS_GATEWAY}/function/${process.env.OCR_FUNCTION_NAME}`
        const response = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                getUrl: urls.imageUrl,
                putUrl: urls.uploadUrl
            })
        });
        //Ha valami hiba volt az ocr function futása során, itt eldobjuk
        if (!response.ok) {
            const text = await response.text();
            throw  new Error(`Hálózati hiba: ${response.status} - ${text}`);
        }
    
    // Visszaküldjük az ocr eredményét a frontendre
        await downloadFile(process.env.STORAGE_BUCKET_NAME, resultFileName, '/tmp/result.json');
        const result_json = await readJsonFile('/tmp/result.json');

        res.json(result_json);

    } catch (error) {
        console.error(error);
        res.status(500).send('Hiba történt!');
    }
});


//Callback fogadása
app.post("/callback", (req, res) => {
    const taskId = req.headers["x-call-id"];
    const result = req.body;

    if(!taskId){
        return res.status(400).send("Nincs X-Call-Id!");
    }

    results[taskId] = result;
    console.log(`Callback érkezett a következő Id-vel: ${taskId}`, result);
    console.log(req)

    res.status(200).send("OK");
});

//Státusz lekérdezése
app.get("/status", (req,res) => {
    const id = req.query.callId;
    if(!id){
        return res.status(400).send("Hiányzik a CallId paraméter!");
    }
    if(results[id]){
        return res.json({status:"done", result: results[id]});
    } else {
        return res.json({status: "pending"});
    }
});

// a "/" enpointon ha megcímzem a szervert, akkor visszaküldi, hogy "Működik"
app.get("/", (req, res) => {
    res.send("Működik");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});