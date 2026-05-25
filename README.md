# MaKandra

MaKandra is een platform dat klanten verbindt met lokale dienstverleners in Suriname. Gebruikers kunnen dienstverleners zoeken, boekingen maken, berichten sturen en beoordelingen achterlaten.

---

## Technologieën

**Frontend**
- HTML5, CSS3, JavaScript (Vanilla)
- Gehost via GitHub Pages

**Backend**
- Node.js met Express.js
- JWT (JSON Web Tokens) voor authenticatie
- Bcrypt.js voor wachtwoordhashing
- Nodemailer voor e-mailverificatie
- MySQL2 voor databaseverbinding

**Database**
- MySQL (relationele database)

---

## Vereisten

Zorg dat het volgende geïnstalleerd is voordat je begint:

- [Node.js](https://nodejs.org/) v18 of hoger
- [npm](https://www.npmjs.com/) v9 of hoger
- MySQL-server (lokaal of via cloud, bijv. Railway, PlanetScale)
- Een SMTP-account voor het verzenden van e-mails (bijv. Gmail, Mailtrap)

---

## Projectstructuur

```
/
├── index.html          # Frontend hoofdpagina
├── style.css           # Frontend styling
├── script.js           # Frontend logica
└── backend/
    ├── server.js               # Entrypoint van de API
    ├── config/
    │   └── db.js               # MySQL databaseverbinding
    ├── routes/                 # API-routes (auth, bookings, jobs, enz.)
    ├── middlewares/            # Middleware (authenticatie, foutafhandeling)
    ├── utils/                  # Hulpfuncties (e-mail, tokens)
    ├── sql/                    # SQL-bestanden voor databasestructuur en seed data
    ├── public/                 # Statische bestanden
    └── .env.example            # Voorbeeld omgevingsvariabelen
```

---

## Installatie

### 1. Repository klonen

```bash
git clone https://github.com/Ja1r117/MaKandra-.git
cd MaKandra-/backend
```

### 2. Omgevingsvariabelen instellen

```bash
cp .env.example .env
```

Vul de volgende waarden in het `.env`-bestand in:

```env
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_PORT=3306

JWT_SECRET=your_super_secret_jwt_key

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password

BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5500
```

### 3. Database instellen

Voer de SQL-bestanden uit in de `sql/`-map om tabellen aan te maken en seed data te laden:

```bash
mysql -u your_user -p your_database < sql/schema.sql
mysql -u your_user -p your_database < sql/seed.sql
```

### 4. Afhankelijkheden installeren

```bash
npm install
```

### 5. Server starten

```bash
# Ontwikkelmodus (met automatisch herladen)
npm run dev

# Productiemodus
npm start
```

De API is bereikbaar op `http://localhost:3000`.

---

## Frontend verbinden met de backend

In `script.js` staat de API-basis URL:

- Lokaal: `http://localhost:3000`
- Productie: vervang door de URL van jouw gedeployde backend

---

## Deployment

De backend kan worden gedeployed op:

- [Railway](https://railway.app/)
- [Render](https://render.com/)
- [Heroku](https://heroku.com/)
- [DigitalOcean](https://www.digitalocean.com/)

> **Let op:** GitHub Pages kan alleen statische bestanden hosten. De Node.js-backend moet apart worden gedeployed.

---

## Belangrijk

- Push **nooit** het `.env`-bestand naar GitHub
- Zorg dat `JWT_SECRET` een sterke, willekeurige string is
- Gebruik HTTPS in productie
