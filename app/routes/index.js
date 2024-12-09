const express = require("express");
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Ruta para el archivo JSON
const dataFilePath = path.join(__dirname, 'datos.json');

// Función para leer los datos del JSON
function leerDatos() {
    try {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// Función para guardar datos en el JSON
function guardarDatos(datos) {
    fs.writeFileSync(dataFilePath, JSON.stringify(datos, null, 2));
}

router.get('/', function (req, res) {
    res.status(200).json({ message: 'Estás conectado a nuestra API' });
});

// Ruta para guardar datos por POST
router.post('/datos', function (req, res) {
    const nuevoDato = req.body;
    const datos = leerDatos();
    datos.push(nuevoDato);
    guardarDatos(datos);
    res.json({ mensaje: '¡Datos guardados por POST!', datos: nuevoDato });
});

// Ruta para guardar datos por parámetros de URL
router.get('/datos', function (req, res) {
    const nuevoDato = req.query;
    const datos = leerDatos();
    datos.push(nuevoDato);
    guardarDatos(datos);
    res.json({ mensaje: '¡Datos guardados por URL!', datos: nuevoDato });
});

// Ruta para obtener datos
router.get('/Mcusr', function (req, res) {
    const datos = leerDatos();
    res.json(datos);
});

router.post('/', function (req, res) {
    res.json({ mensaje: 'Método post' });
});

router.put('/', function (req, res) {
    res.json({ mensaje: 'Método put' });
});

module.exports = router;