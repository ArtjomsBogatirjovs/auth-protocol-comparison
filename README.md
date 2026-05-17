# Auth Protocol Comparison

Šis projekts ir izstrādāts bakalaura darba **“SAML, OAuth/OpenID Connect un WebAuthn protokolu salīdzinājums autentifikācijas un autorizācijas drošības un efektivitātes aspektā”** praktiskās daļas vajadzībām.

Projekta mērķis ir nodrošināt vienotu testēšanas vidi, kurā iespējams realizēt un salīdzināt trīs autentifikācijas risinājumus:

- SAML;
- OpenID Connect;
- WebAuthn.

Projektā tiek izmantota viena Express tīmekļa lietotne, Keycloak identitātes nodrošinātājs un PostgreSQL datubāze mērījumu un WebAuthn akreditācijas datu saglabāšanai.

## Realizētā funkcionalitāte

Projektā ir realizēts:

- OpenID Connect autentifikācijas plūsma ar Keycloak;
- SAML autentifikācijas plūsma ar Keycloak;
- WebAuthn reģistrācijas un autentifikācijas plūsma ar SimpleWebAuthn;
- lietotāja sesijas izveide pēc veiksmīgas autentifikācijas;
- aizsargāts resurss `/protected`;
- atteikšanās no sistēmas `/logout`;
- WebAuthn akreditācijas datu saglabāšana PostgreSQL datubāzē;
- WebAuthn akreditācijas datu apskates tabula;
- autentifikācijas mērījumu saglabāšana;
- mērījumu apskate JSON formātā;
- eksperimenta skripts autentifikācijas plūsmu mērīšanai.

## Izmantotās tehnoloģijas

- Node.js
- TypeScript
- Express
- EJS
- PostgreSQL
- Docker Compose
- Keycloak
- Passport
- passport-saml
- openid-client
- SimpleWebAuthn
- Playwright

## Projekta struktūra

```text
auth-protocol-comparison/
├── app/
│   ├── certs/
│   │   └── saml-cert.pem
│   ├── src/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── experiment/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── views/
│   │   └── server.ts
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
├── docs/
├── keycloak/
│   ├── auth-comparison-realm.json
│   └── certs/
├── docker-compose.yml
└── README.md
```

## Prasības palaišanai

Pirms projekta palaišanas datorā jābūt instalētam:

- Node.js;
- npm;
- Docker;
- Docker Compose.

## Projekta konfigurācija

Lietotnes konfigurācija atrodas failā:

```text
app/.env
```

Fails `.env` satur lokālās izstrādes konfigurāciju, tādēļ produkcijas vidē to nedrīkst glabāt publiski pieejamā repozitorijā.

## Palaišana

### 1. Klonēt repozitoriju

```bash
git clone https://github.com/ArtjomsBogatirjovs/auth-protocol-comparison.git
cd auth-protocol-comparison
```

### 2. Palaist Docker servisus

```bash
docker compose up -d
```

Šī komanda palaiž:

- PostgreSQL datubāzi;
- Keycloak serveri.

PostgreSQL ir pieejams lokāli:

```text
localhost:55432
```

Keycloak ir pieejams:

```text
http://localhost:8080
```

Keycloak administratora piekļuve:

```text
lietotājs: admin
parole: admin
```

Realm nosaukums:

```text
auth-comparison
```

Testa lietotājs autentifikācijai:

```text
lietotājs: testuser
parole: testpass
```

### 3. Uzinstalēt Node.js atkarības

```bash
cd app
npm install
```

### 4. Palaist lietotni izstrādes režīmā

```bash
npm run dev
```

Pēc palaišanas lietotne ir pieejama:

```text
http://localhost:3000
```

## Keycloak realm importa piezīme

Keycloak konfigurācija tiek importēta no faila:

```text
keycloak/auth-comparison-realm.json
```

Ja Keycloak realm konfigurācija tiek mainīta un vecais Docker volume jau pastāv, realm imports var netikt izpildīts atkārtoti. Šādā gadījumā jādzēš esošie konteineri un volumes:

```bash
docker compose down -v
docker compose up -d
```

Pēc šīs darbības Keycloak un PostgreSQL dati tiks izveidoti no jauna.

## Pieejamie maršruti

### Galvenie maršruti

```text
GET /                       sākumlapa
GET /protected              aizsargāts resurss
GET /logout                 atteikšanās no sistēmas
```

### OpenID Connect

```text
GET /auth/oidc              sāk OpenID Connect autentifikāciju
GET /auth/oidc/callback     apstrādā OpenID Connect callback
GET /logout/oidc            veic OpenID Connect logout
```

### SAML

```text
GET  /auth/saml             sāk SAML autentifikāciju
POST /auth/saml/callback    apstrādā SAMLResponse
GET  /logout/saml           sāk SAML logout
POST /logout/saml/callback  apstrādā SAML logout callback
```

### WebAuthn

```text
GET  /webauthn                              WebAuthn testēšanas lapa
GET  /auth/webauthn                         pāradresē uz WebAuthn testēšanas lapu
POST /auth/webauthn/register/options        ģenerē reģistrācijas challenge
POST /auth/webauthn/register/verify         pārbauda reģistrācijas atbildi
POST /auth/webauthn/login/options           ģenerē autentifikācijas challenge
POST /auth/webauthn/login/verify            pārbauda autentifikācijas atbildi
GET  /webauthn/credentials                  parāda saglabātos WebAuthn credentials
```

### Mērījumi

```text
GET /metrics                 visi autentifikācijas mērījumi JSON formātā
GET /metrics/summary         mērījumu kopsavilkums JSON formātā
```

## WebAuthn lietošana

Lai pārbaudītu WebAuthn autentifikāciju:

1. atvērt lapu:

```text
http://localhost:3000/webauthn
```

2. ievadīt lietotājvārdu vai atstāt noklusēto `testuser`;
3. nospiest `Register`;
4. apstiprināt reģistrāciju ar Windows Hello, PIN, Touch ID vai citu pieejamu autentifikatoru;
5. pēc veiksmīgas reģistrācijas nospiest `Login`;
6. pēc veiksmīgas autentifikācijas lietotājs tiek pāradresēts uz `/protected`.

Saglabātos WebAuthn akreditācijas datus var apskatīt:

```text
http://localhost:3000/webauthn/credentials
```

Tabulā redzami:

- lietotāja identifikators;
- lietotājvārds;
- credential ID;
- publiskā atslēga;
- parakstu skaitītājs;
- izmantotie transporti.

Šī tabula apliecina, ka WebAuthn plūsma izmanto serverī saglabātus autentifikatora datus, nevis fiktīvu lietotāja pieteikšanos.

## Eksperimenta palaišana

Pirms eksperimenta palaišanas jābūt palaistiem Docker servisiem un Express lietotnei.

Pirmajā terminālī:

```bash
docker compose up -d
cd app
npm run dev
```

Otrajā terminālī:

```bash
cd app
npm run experiment
```

Eksperimenta atkārtojumu skaitu nosaka `.env` mainīgais:

```env
EXPERIMENT_RUNS=10
```

Eksperimenta rezultāti tiek saglabāti PostgreSQL tabulā `auth_metrics`.

Rezultātus var apskatīt:

```text
http://localhost:3000/metrics
http://localhost:3000/metrics/summary
```

## Eksperimentā reģistrējamie rādītāji

Eksperimenta laikā tiek reģistrēti šādi rādītāji:

| Rādītājs | Nozīme |
|---|---|
| `protocol` | autentifikācijas protokols |
| `scenario` | eksperimenta scenārijs |
| `result` | autentifikācijas rezultāts |
| `duration_ms` | autentifikācijas ilgums milisekundēs |
| `http_requests` | HTTP pieprasījumu skaits |
| `redirects` | pāradresāciju skaits |
| `bytes_transferred` | autentifikācijas laikā pārsūtīto datu apjoms |
| `created_at` | mērījuma izveides laiks |

Mērījumi raksturo konkrētā prototipa testēšanas vidi, nevis visu iespējamo SAML, OpenID Connect vai WebAuthn ieviešanu veiktspēju.

## Datubāzes tabulas

Projektā tiek izmantotas divas galvenās tabulas.

### `auth_metrics`

Tabulā tiek saglabāti autentifikācijas mērījumi.

Galvenie lauki:

```text
id
protocol
scenario
user_id
result
duration_ms
http_requests
redirects
bytes_transferred
notes
created_at
```

### `webauthn_credentials`

Tabulā tiek saglabāti WebAuthn reģistrācijas dati.

Galvenie lauki:

```text
id
user_id
username
credential_id
credential_public_key
counter
transports
created_at
```

## Kompilācija

Lai pārbaudītu TypeScript kompilāciju:

```bash
cd app
npm run build
```

Lai palaistu kompilēto versiju:

```bash
npm run start
```

## Biežākās problēmas

### Keycloak realm netiek atjaunots

Ja mainīts `keycloak/auth-comparison-realm.json`, bet Keycloak joprojām rāda veco konfigurāciju, jāizdzēš Docker volumes:

```bash
docker compose down -v
docker compose up -d
```

### SAML sertifikāta kļūda

Jāpārbauda, vai `.env` mainīgais:

```env
SAML_CERT_PATH=certs/saml-cert.pem
```

norāda uz eksistējošu sertifikāta failu mapē `app/certs`.

### WebAuthn nedarbojas

Lokālajā vidē WebAuthn darbojas ar `localhost`. Ja tiek izmantots cits domēns vai IP adrese, jāmaina:

```env
WEBAUTHN_RP_ID
WEBAUTHN_ORIGIN
```

Produkcijas vidē WebAuthn jāizmanto ar HTTPS.

### Datubāzes pieslēguma kļūda

Jāpārbauda, vai `.env` datubāzes ports sakrīt ar `docker-compose.yml` portu:

```env
DB_PORT=55432
```

## Ierobežojumi

Šis projekts ir eksperimentāls prototips bakalaura darba praktiskajai daļai. Tas nav paredzēts izmantošanai produkcijas vidē.

Eksperimenta rezultāti ir interpretējami konkrētās testēšanas vides ietvaros. Tie ļauj salīdzināt realizētās SAML, OpenID Connect un WebAuthn plūsmas vienādos apstākļos, bet nav uzskatāmi par universālu visu iespējamo protokolu ieviešanu drošības vai veiktspējas novērtējumu.

## Autors

Artjoms Bogatirjovs  
Rīgas Tehniskā universitāte  
Bakalaura darbs, 2026