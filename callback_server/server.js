const express = require("express");
const Minio = require("minio");
const multer = require("multer");
const app = express();
const uploadImageToStorage = multer({ storage: multer.memoryStorage() });

app.use(express.json());

const results = {};

//OpenFaas környezeti változók beolvasása
const openfaasGateway = process.env.OPENFAAS_GATEWAY;
const ocrFunction = process.env.OCR_FUNCTION_NAME;
// `${openfaasGateway}/function/${ocrFunction}`

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ROOT_USER,
    secretKey: process.env.MINIO_ROOT_PASSWORD,
});

app.post('/upload', uploadImageToStorage.single('image'), async (req, res) => {
    try {
        if(!req.file){
            return res.status(400).send('Nem érkezett fájl.');
        }
        const { v4: uuidv4} = await import('uuid');

        const fileBuffer = req.file.buffer;
        const extension = req.file.originalname.split('.').pop();
        const fileName = `${uuidv4()}.${extension}`;
        console.log("Fájl feltöltése a következő filename-val: " + fileName);

        await minioClient.putObject('ocr-bucket', fileName, fileBuffer);

        //visszaküldjük a filename-t
        res.send({ fileName });

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