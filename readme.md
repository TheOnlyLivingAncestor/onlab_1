# Optikai karakter-felismerés munkafolyamat kidolgozása mikroszolgáltatásokra épülve

## Szinkronos verzió
### KIND cluster készítése az OpenFaaS használatához:
KIND feltelepítéséhez és használatához a [KIND dokumentációt](https://kind.sigs.k8s.io/docs/user/quick-start/#installation) ajánlom.

    kind create cluster --name openfaas-ocr --image=kindest/node:v1.34.0@sha256:7416a61b42b1662ca6ca89f02028ac133a309a2a30ba309614e8ec94d976dc5a

Ez a parancs egy KIND clustert készít `openfaas-ocr` névvel, Kubernetes 1.34 verzióval. 
A cluster készítést követően a kubernetes kontext automatikusan arra a clusterre mutat, amit létrehoztunk, így nincs szükség kubeconfigot beállítani, és a `kubectl`, valamint `helm` parancsok automatikusan ezt a clustert használják.

A kind cluster nem éli túl a docker daemon újraindítását, így az nem ajánlott. Docker használatával a konténert meg lehet állítani (`docker pause`), így nem eszi fel az erőforrásokat.

### OpenFaaS felinstallálása
Az [OpenFaas dokumentáció](https://docs.openfaas.com/deployment/kubernetes/) elég jól leírja, hogyan kell felinstallálni a cli-t a saját gépre, és az openfaas-t a kubernetes clusterre.

Az openfaas az installálás végeztével kiírja a teendőket, olvassuk el és hajtsuk végre figyelmesen.

Az openfaas function -ok használatához a clusteren kívül gateway forwarding szükséges (ezt is leírja az install). Azt a parancsot egy új terminálablakban szoktam kiadni, és azt a továbbiakban nyitva hagyom és nem használom.

### OpenFaas funkció felinstallálása

Az általam készített funkció az `openfaas-debian-template` mappában található. Ha bárki más rajtam kívül, lokálisan ki szeretné próbálni az egész folyamatot, akkor a stack.yaml-ben módosítani kell az image nevet, `docker_felhasználónév/image_neve:latest` formában (Esetleg további docker tagolásra is szükség lehet).

A function installálásához a következő parancsokat hajtottam végre:
1.  `faas-cli build stack.yaml` elkészíti a docker image-t. Az OpenFaaS ingyenes verziójával csak publikus image-ket lehet használni, így az image készítéséhez azt fel kell pusholni a dockerhub-ra.
2.  `docker push docker_felhasználónév/image_neve:latest` felpusholja az image-t a docker-hubra.
3.  `faas-cli deploy stack.yaml` fogja a kuberentes clusterre felinstallálni az elkészült funkciót. A konzolon kapunk egy linket is, amin keresztül a funkciót el lehet érni. Az `openfaas-fn` namespace-ben lehet megtekinteni a funkció állapotát (fut-e a pod.)

### Object Storage

Az async működés előkészítéséhez szükségem volt egy tárolóra, ahova fel lehet tölteni az eredményeket (mivel a function visszaad egy annotált képet). Ehhez minio-t installáltam.
`kubectl create ns minio`
`helm install minio minio/minio -n minio -f object_storage/minio_deployment.yaml`
A bucket, ahova a fájlok feltöltésre kerülnek, jelenleg kézzel készült, így be kell lépni a minio console-ra (felhasználónév/jelszó az előző kubernetes manifestben, valamint a minio-console service-t port forwardolni kell), és létrehozni a bucketet `ocr-bucket` névvel (vagy más névvel, de akkor a callbac-szerverben lévő configmapet is módosítani kell).

### Callback szerver

Ahhoz, hogy az async működést előkészítsem, létrehoztam egy callback szervert (hívhatjuk backendnek is), ami jelenleg az object storage hozzáférést és a function hívást kezeli.
Konténerizált, az előbb létrehozott clusterre a következő paranccsal lehet feltenni:
`kubectl apply -f callback-server/callback-server-k8s.yaml`
A service-n keresztül lehet kommunikálni vele. A paraméterek a configmap és secret használatával módosíthatóak.

### Frontend

A frontenden lehet megadni a képet, amin az angol nyelvű szöveget fel szeretnénk ismerni. Installálni a clusterre a következő paranccsal lehet:
`kubectl apply -f frontend/frontend_k8s.yaml`
Ahhoz, hogy a böngészőből elérhessük, a service-t port forwardolni kell, és localhostról a böngészőben elérhető.
A kép feltöltését követően a frontend elküldi a képet a backendnek processzálásra, ami feltölti a képet az object storage-ba és a megfelelő url-ekkel meghívja az openfaas function-t, a választ pedig visszaküldi a frontendnek, ami ezt megjeleníti a detektált szöveggel együtt.

### Jó tanácsok a fejlesztéshez
Amikor az OpenFaaS template `handler.py` függvényét módosítottam, a build nem mindig vette fel a módosítást, így a `docker push` során nem került fel semmi módosított réteg a latest image-be, amit használni szerettem volna. Ezen nem segített a docker push cache-mentes változata, így én mindig törölgettem a docker rendszerét (`docker system prune -a`), hogy teljesen tiszta lappal induljon a `faas-cli build`. Ez persze minden nem használt (konténer által) image-t letöröl, így fokozott óvatosságra intem a parancs használóit!