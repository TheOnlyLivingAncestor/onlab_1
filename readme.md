# Optikai karakter-felismerés munkafolyamat kidolgozása mikroszolgáltatásokra épülve

## Szinkronos verzió
### KIND cluster készítése az OpenFaaS használatához:
KIND feltelepítéséhez és használatához a [KIND dokumentációt](https://kind.sigs.k8s.io/docs/user/quick-start/#installation) ajánlom.

    kind create cluster --name openfaas-ocr --image=kindest/node:v1.34.0@sha256:7416a61b42b1662ca6ca89f02028ac133a309a2a30ba309614e8ec94d976dc5a

Ez a parancs egy KIND clustert készít `openfaas-ocr` névvel, Kubernetes 1.34 verzióval. 
A cluster készítést követően a kubernetes kontext auomatikusan arra a clusterre mutat, amit létrehoztunk, így nincs szükség kubeconfigot beállítani, és a `kubectl`, valamint `helm` parancsok automatikusan ezt a clustert használják.

A kind cluster nem éli túl a docker daemon újraindítását, így az nem ajánlott. Docker használatával a konténert meg lehet állítani (`docker pause`), így nem eszi fel az erőforrásokat.

### OpenFaaS felinstallálása
Az [OpenFaas dokumentáció](https://docs.openfaas.com/deployment/kubernetes/) elég jól leírja, hogyan kell felinstallálni a cli-t a saját gépre, és az openfaas-t a kubernetes clusterre.

Az openfaas az installálás végeztével kiírja a teendőket, olvassuk el és hajtsuk végre figyelmesen.

Az openfaas function -ok használatához gateway forwarding szükséges (ezt is leírja az install). Ezt a parancsot egy új terminálablakban szoktam kiadni, és azt a továbbiakban nyitva hagyom és nem használom.

    gateway forwarding
    kubectl rollout status -n openfaas deploy/gateway
    kubectl port-forward -n openfaas svc/gateway 8080:8080 &

### OpenFaas funkció felinstallálása

Az általam készített funkció az `openfaas-debian-template` mappában található. Ha bárki más rajtam kívül, lokálisan ki szeretné próbálni az egész folyamatot, akkor a stack.yaml-ben módosítani kell az image nevet, `docker_felhasználónév/image_neve:latest` formában (Esetleg további docker tagolásra is szükség lehet), valamint a `frontend/frontend_scripts.js` fájlban a `FUNCTION_URL` változót is módosítani kell.

A function installálásához a következő parancsokat hajtottam végre:
1.  `faas-cli build stack.yaml` elkészíti a docker image-t. Az OpenFaaS ingyenes verziójával csak publikus image-ket lehet használni, így az image készítéséhez azt fel kell pusholni a dockerhub-ra.
2.  `docker push docker_felhasználónév/image_neve:latest` felpusholja az image-t a docker-hubra.
3.  `faas-cli deploy stack.yaml` fogja a kuberentes clusterre felinstallálni az elkészült funkciót. A konzolon kapunk egy linket is, amin keresztül a funkciót el lehet érni. Az `openfaas-fn` namespace-ben lehet megtekinteni a funkció állapotát (fut-e a pod.)
4. A frontend értelemszerűen a `frontent` mappában található. A HTML fájlt bármelyik böngészőben megnyitva lehet használni a weboldalt. (Még nem konténerizáltam; lokálisan sokkal egyszerűbb tesztelgetni.)

### Jó tanácsok a fejlesztéshez
Amikor az OpenFaaS template `handler.py` függvényét módosítottam, a build nem mindig vette fel a módosítást, így a `docker push` során nem került fel semmi módosított réteg a latest image-be, amit használni szerettem volna. Ezen nem segített a docker push cache-mentes változata, így én mindig törölgettem a docker rendszerét (`docker system prune -a`), hogy teljesen tiszta lappal induljon a `faas-cli build`. Ez persze minden nem használt (konténer által) image-t letöröl, így fokozott óvatosságra intem a parancs használóit!