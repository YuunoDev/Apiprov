const express = require('express');
const router = express.Router();
const SpotifyWebApi = require('spotify-web-api-node');

// Configura tus credenciales de Spotify
const spotifyApi = new SpotifyWebApi({
    clientId: 'cc5410b68ea947cb82e6562a9fa2ff4d',
    clientSecret: '0b1b5539952a4940b5f1a99635a986d7',
    redirectUri: 'http://localhost:8080/api/callback' // Ajusta según tu configuración
});

// Ruta para iniciar el proceso de login
router.get('/login', (req, res) => {
    const scopes = [
        'user-read-private',
        'user-read-email',
        'user-top-read'
    ];
    
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
    res.redirect(authorizeURL);
});

// Callback después del login
router.get('/callback', async (req, res) => {
    const { code } = req.query;
    
    try {
        const data = await spotifyApi.authorizationCodeGrant(code);
        
        // Guarda los tokens
        spotifyApi.setAccessToken(data.body['access_token']);
        spotifyApi.setRefreshToken(data.body['refresh_token']);

        console.log('Token de acceso:', data.body['access_token']);
        console.log('Token de actualización:', data.body['refresh_token']);

        
        //mostrar mensaje de exito
        //res.send('Login exitoso');
        res.redirect('http://localhost:8080/api/dashboard');
    } catch (error) {
        res.status(400).json({ error: 'Error en autenticación' });
    }
});

// Obtener perfil del usuario
router.get('/perfil', async (req, res) => {
    try {
        const data = await spotifyApi.getMe();
        res.json(data.body);
    } catch (error) {
        res.status(400).json({ error: 'Error al obtener perfil' });
    }
});

// Obtener top tracks del usuario
router.get('/top-tracks', async (req, res) => {
    try {
        const data = await spotifyApi.getMyTopTracks({
            limit: 20,
            offset: 0,
            time_range: 'medium_term' // last 6 months
        });
        
        // Procesar y formatear la información
        const topTracks = data.body.items.map(track => ({
            id: track.id,
            nombre: track.name,
            album: track.album.name,
            artista: track.artists[0].name,
            generos: track.artists[0].genres,
            popularidad: track.popularity,
            preview_url: track.preview_url,
            imagen_album: track.album.images[0].url
        }));
        
        res.json(topTracks);
    } catch (error) {
        res.status(400).json({ error: 'Error al obtener top tracks' });
    }
});

// Obtener géneros de un artista
router.get('/track-info/:trackId', async (req, res) => {
    try {
        const trackData = await spotifyApi.getTrack(req.params.trackId);
        const artistId = trackData.body.artists[0].id;
        const artistData = await spotifyApi.getArtist(artistId);
        
        const trackInfo = {
            nombre: trackData.body.name,
            album: trackData.body.album.name,
            artista: trackData.body.artists[0].name,
            generos: artistData.body.genres,
            duracion_ms: trackData.body.duration_ms,
            popularidad: trackData.body.popularity,
            preview_url: trackData.body.preview_url,
            imagen_album: trackData.body.album.images[0].url
        };
        
        res.json(trackInfo);
    } catch (error) {
        res.status(400).json({ error: 'Error al obtener información de la canción' });
    }
});


//Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const data = await spotifyApi.getMe();
        res.json(data.body);
    } catch (error) {
        res.status(400).json({ error: 'Error al obtener perfil' });
    }
});

// Refrescar el token cuando expire
async function refreshAccessToken() {
    try {
        const data = await spotifyApi.refreshAccessToken();
        spotifyApi.setAccessToken(data.body['access_token']);
    } catch (error) {
        console.error('Error al refrescar el token:', error);
    }
}

module.exports = router;