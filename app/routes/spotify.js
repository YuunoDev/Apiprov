const express = require('express');
const router = express.Router();
const SpotifyWebApi = require('spotify-web-api-node');
//GRUPOS DE SPOTIFY
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const e = require('express');

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
        'playlist-modify-private',  // Para crear playlists privadas
        'playlist-modify-public',   // Si también quieres permitir playlists públicas
        'user-top-read',
        'user-library-read',
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
        res.redirect(`http://localhost:4200/dashboard?access_token=${data.body['access_token']}`);
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


// Estructura para almacenar información de grupos
const GROUPS_FILE = path.join(__dirname, 'groups.json');

// Función para generar ID único para grupos
function generateGroupId() {
    return crypto.randomBytes(4).toString('hex');
}

// Función para leer datos de grupos
async function readGroupsData() {
    try {
        const data = await fs.readFile(GROUPS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Si el archivo no existe, retorna un objeto vacío
        return {};
    }
}

// Función para guardar datos de grupos
async function saveGroupsData(data) {
    await fs.writeFile(GROUPS_FILE, JSON.stringify(data, null, 2));
}

//informacion de todos los grupos
router.get('/groups', async (req, res) => {
    try {
        const groups = await readGroupsData();
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener información de grupos' });
    }
});

// Crear un nuevo grupo
router.post('/group/create', async (req, res) => {
    try {
        //nombre del grupo se manda por post
        const nombreGrupo = req.body.nombreGrupo;

        const groupId = generateGroupId();
        const groups = await readGroupsData();

        groups[groupId] = {
            id: groupId,
            namegroup: nombreGrupo,
            members: [],
            createdAt: new Date().toISOString()
        };

        await saveGroupsData(groups);

        //mostrar link con ip y puerto
        res.json({
            groupId,
            message: 'Grupo creado exitosamente',
            id: groupId,
            link: `http://localhost:8080/api/groups/${groupId}/join`
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear grupo' });
    }
});

// Unirse a un grupo y guardar preferencias musicales
router.post('/groups/:groupId/join', async (req, res) => {
    try {
        const { groupId } = req.params;
        const groups = await readGroupsData();

        if (!groups[groupId]) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        // Obtener top tracks del usuario
        const topTracks = await spotifyApi.getMyTopTracks({
            limit: 20,
            time_range: 'medium_term'
        });

        // Obtener información del usuario
        const userData = await spotifyApi.getMe();

        // Extraer géneros de los artistas
        const artistIds = [...new Set(topTracks.body.items.map(track => track.artists[0].id))];
        const artistsData = await Promise.all(
            artistIds.map(id => spotifyApi.getArtist(id))
        );

        const genres = [...new Set(
            artistsData.flatMap(artist => artist.body.genres)
        )];

        const memberData = {
            userId: userData.body.id,
            name: userData.body.display_name,
            topGenres: genres,
            topTracks: topTracks.body.items.map(track => ({
                id: track.id,
                name: track.name,
                artist: track.artists[0].name
            })),
            joinedAt: new Date().toISOString()
        };

        // Agregar usuario al grupo si no existe
        if (!groups[groupId].members.find(member => member.userId === userData.body.id)) {
            groups[groupId].members.push(memberData);
        }

        await saveGroupsData(groups);

        res.json({
            message: 'Usuario agregado al grupo exitosamente',
            memberData
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al unirse al grupo' });
    }
});

//Obtener grupos de usuario
router.get('/group/user', async (req, res) => {
    try {
        const groups = await readGroupsData();
        const userData = await spotifyApi.getMe();
        const userId = userData.body.id;

        const userGroups = Object.values(groups)

            .filter(group => group.members.find(member => member.userId === userId))
            .map(group => ({
                id: group.id,
                name: group.namegroup,
                members: group.members,
                playlist: group.playlist,
                createdAt: group.createdAt
            }));

        res.json(userGroups);

    } catch (error) {
        res.status(500).json({ error: 'Error al obtener grupos del usuario' });
    }
});


// Obtener información del grupo
router.get('/groups/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const groups = await readGroupsData();

        if (!groups[groupId]) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        res.json(groups[groupId]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener información del grupo' });
    }
});

// Obtener géneros comunes del grupo
router.get('/groups/:groupId/common-genres', async (req, res) => {
    try {
        const { groupId } = req.params;
        const groups = await readGroupsData();

        if (!groups[groupId]) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        // Crear un mapa de géneros y su frecuencia
        const genreFrequency = {};
        groups[groupId].members.forEach(member => {
            member.topGenres.forEach(genre => {
                genreFrequency[genre] = (genreFrequency[genre] || 0) + 1;
            });
        });

        // Ordenar géneros por frecuencia
        const commonGenres = Object.entries(genreFrequency)
            .sort(([, a], [, b]) => b - a)
            .map(([genre, count]) => ({
                genre,
                count,
                percentage: (count / groups[groupId].members.length) * 100
            }));

        res.json(commonGenres);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener géneros comunes' });
    }
});

// Endpoint para crear playlist grupal
router.post('/groups/:groupId/create-playlist', async (req, res) => {
    try {
        const { groupId } = req.params;
        const groups = await readGroupsData();

        const meResponse = await spotifyApi.getMe();
        const userId = meResponse.body.id;  // Extract ID from response

        if (!userId) {
            return res.status(401).json({ error: 'Token de Spotify no válido' });
        }

        // Verificar si el grupo existe
        if (!groups[groupId]) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        // // Verificar que haya al menos 2 miembros
        // if (groups[groupId].members.length < 2) {
        //     return res.status(400).json({ 
        //         error: 'Se necesitan al menos 2 miembros en el grupo para crear una playlist' 
        //     });
        // }

        // Obtener el primer miembro (creador del grupo)
        const groupCreator = groups[groupId].members[0];
        console.log('Creating playlist for user:', groupCreator.userId);

        // Obtener géneros comunes con más del 50% de coincidencia
        const genreFrequency = {};
        groups[groupId].members.forEach(member => {
            member.topGenres.forEach(genre => {
                genreFrequency[genre] = (genreFrequency[genre] || 0) + 1;
            });
        });
        console.log('Genre frequency:', genreFrequency);

        const commonGenres = Object.entries(genreFrequency)
            .filter(([, count]) => (count / groups[groupId].members.length) >= 0.5)
            .map(([genre]) => genre);

        if (commonGenres.length === 0) {
            return res.status(400).json({
                error: 'No se encontraron géneros en común suficientes entre los miembros'
            });
        }
        console.log('Common genres:', commonGenres);

        // Crear la playlist
        const playlistName = `Grupo ${groups[groupId].namegroup} - Playlist Compartida`;
        // Get the current user's ID from the me object
        const playlist = await spotifyApi.createPlaylist(userId, {
            name: playlistName,
            description: 'Playlist generada automáticamente basada en los gustos del grupo',
            public: false,
            collaborative: true,
            display_name: playlistName
        });
        console.log('Playlist created:', playlist.body);

        // obtener de cada miembro las canciones
        const trackUris = [];

        for (const member of groups[groupId].members) {
            const topTracks = await spotifyApi.getMyTopTracks({
                limit: 5,
                time_range: 'medium_term',
                offset: 0,
                id: member.userId
            });

            // Primero obtener los detalles de los artistas
            const artistIds = topTracks.body.items
                .flatMap(track => track.artists.map(artist => artist.id));

            const uniqueArtistIds = [...new Set(artistIds)];
            const artistsInfo = await spotifyApi.getArtists(uniqueArtistIds);

            // Crear un mapa de artistas con sus géneros
            const artistGenresMap = new Map(
                artistsInfo.body.artists.map(artist => [artist.id, artist.genres])
            );

            // Ahora filtrar las canciones
            const filteredTracks = topTracks.body.items
                .filter(track => track.artists.some(artist => {
                    const artistGenres = artistGenresMap.get(artist.id) || [];
                    return commonGenres.some(genre => artistGenres.includes(genre));
                }))
                .map(track => track.uri);

            trackUris.push(...filteredTracks);
        }

        // Agregar canciones a la playlist
        await spotifyApi.addTracksToPlaylist(playlist.body.id, trackUris);
        console.log('Tracks added to playlist:', trackUris);


        // Guardar la información de la playlist en el grupo
        groups[groupId].playlist = {
            id: playlist.body.id,
            name: playlistName,
            createdAt: new Date().toISOString(),
            url: playlist.body.external_urls.spotify,
            trackCount: trackUris.length
        };

        await saveGroupsData(groups);

        res.json({
            message: 'Playlist creada exitosamente',
            playlist: groups[groupId].playlist,
            genresUsed: commonGenres
        });

    } catch (error) {
        console.error('Error al crear la playlist:', error);
        res.status(500).json({ error: 'Error al crear la playlist' });
    }
});

// Endpoint para obtener información de la playlist del grupo
router.get('/groups/:groupId/playlist', async (req, res) => {
    try {
        const { groupId } = req.params;
        const groups = await readGroupsData();

        if (!groups[groupId]) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        if (!groups[groupId].playlist) {
            return res.status(404).json({ error: 'Este grupo aún no tiene una playlist' });
        }

        // Obtener información actualizada de la playlist
        const playlistInfo = await spotifyApi.getPlaylist(groups[groupId].playlist.id);

        const playlistData = {
            ...groups[groupId].playlist,
            currentTrackCount: playlistInfo.body.tracks.total,
            image: playlistInfo.body.images[0]?.url,
            ownerName: playlistInfo.body.owner.display_name
        };

        res.json(playlistData);

    } catch (error) {
        console.error('Error al obtener información de la playlist:', error);
        res.status(500).json({ error: 'Error al obtener información de la playlist' });
    }
});


module.exports = router;