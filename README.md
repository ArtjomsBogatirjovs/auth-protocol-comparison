# Autentifikācijas protokolu salīdzinājums

Šis projekts ir izstrādāts bakalaura darba **“SAML, OAuth/OpenID Connect un WebAuthn protokolu salīdzinājums autentifikācijas un autorizācijas drošības un efektivitātes aspektā”** praktiskās daļas vajadzībām.

## Projekta mērķis

Projekta mērķis ir izveidot vienotu references tīmekļa lietotni, kurā iespējams salīdzināt trīs autentifikācijas risinājumus:

- **SAML**
- **OpenID Connect**
- **WebAuthn**

Sistēma nodrošina vienotu vidi eksperimentu veikšanai, autentifikācijas rezultātu reģistrēšanai un salīdzināmu datu iegūšanai.

## Projekta struktūra

```text
auth-protocol-comparison/
├── app/
│   ├── src/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── views/
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── docker-compose.yml
├── docs/
├── keycloak/
└── scripts/
````

## Izmantotās tehnoloģijas

* **Node.js**
* **TypeScript**
* **Express**
* **PostgreSQL**
* **Docker Compose**
* **Keycloak**
* **SimpleWebAuthn**

## Pašreiz realizētā funkcionalitāte

Šobrīd projektā ir realizēts:

* Express lietotnes pamata karkass
* sesiju pārvaldība ar `express-session`
* sākumlapa ar trim autentifikācijas izvēlēm
* aizsargāts resurss
* PostgreSQL pieslēgums
* autentifikācijas metriku saglabāšana datubāzē
* testa maršruti SAML, OpenID Connect un WebAuthn simulācijai

## Prasības palaišanai

Pirms projekta palaišanas jābūt instalētiem:

* **Node.js**
* **npm**
* **Docker**
* **Docker Compose**

## Projekta palaišana

### 1. Klonēt repozitoriju

```bash
git clone https://github.com/ArtjomsBogatirjovs/auth-protocol-comparison.git
cd auth-protocol-comparison
```

### 2. Palaist PostgreSQL konteineru

```bash
docker compose up -d
```

### 3. Pāriet uz lietotnes mapi

```bash
cd app
```

### 4. Uzinstalēt atkarības

```bash
npm install
```

### 5. Izveidot `.env` failu

Piemērs:

```env
PORT=3000
SESSION_SECRET=dev_secret_change_me

DB_HOST=localhost
DB_PORT=5432
DB_NAME=authdb
DB_USER=authuser
DB_PASSWORD=authpass
```

### 6. Palaist projektu izstrādes režīmā

```bash
npm run dev
```

Pēc palaišanas lietotne būs pieejama šeit:

```text
http://localhost:3000
```

## Pieejamie maršruti

* `/` — sākumlapa
* `/auth/saml` — SAML testa autentifikācija
* `/auth/oidc` — OpenID Connect testa autentifikācija
* `/auth/webauthn` — WebAuthn testa autentifikācija
* `/protected` — aizsargāts resurss
* `/metrics` — saglabātie mērījumi JSON formātā
* `/logout` — sesijas dzēšana

## Datubāzes tabula

Projektā tiek izmantota tabula `auth_metrics`, kurā tiek saglabāti autentifikācijas mērījumi.

Galvenie lauki:

* `id`
* `protocol`
* `user_id`
* `result`
* `duration_ms`
* `created_at`

## Piezīmes

Šī projekta pašreizējā versija ir eksperimentāls prototips bakalaura darba praktiskajai daļai. Sākotnēji autentifikācijas plūsmas ir realizētas vienkāršotā veidā, lai pārbaudītu sistēmas arhitektūru, sesiju pārvaldību un mērījumu reģistrēšanas mehānismu.

## Autors

Artjoms Bogatirjovs
Rīgas Tehniskā universitāte
Bakalaura darbs, 2026
