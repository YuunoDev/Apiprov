var express = require('express') //llamamos a Express
var app = express(); // definimos la app usando express
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require('path');
const rutas = require("./routes/index");
const spotify = require("./routes/spotify");

var port = process.env.PORT || 8080  // establecemos nuestro puerto

app.use(cors({
    origin: 'https://nodejs-render-jzcu.onrender.com',  
  }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());        // configuramos la app para usar bodyParser

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Ruta específica para el index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/prov', rutas);
app.use('/api', spotify);

// iniciamos nuestro servidor
app.listen(port, (err, res) => {
    if (err) {
        console.log(`Error al iniciar el servidor: ${err}`);
    } else {
        console.log(`Servidor iniciado en: http://localhost:${port}`);
    }
});
console.log('API escuchando en el puerto ' + port)