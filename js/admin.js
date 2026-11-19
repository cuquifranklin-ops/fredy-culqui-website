// ===== GESTOR DE PORTAFOLIO CON API DE GITHUB =====
if (sessionStorage.getItem('fc_admin_auth') !== 'true') {
    window.location.href = 'login.html';
}

const CONFIG_KEY = 'fc_github_config';
let portfolioState = { heroVideo: '', items: [] };
let currentJsonSha = null;

document.addEventListener('DOMContentLoaded', () => {
    loadSavedConfig();
    bindEvents();
    loadPortfolioFromGitHub();
});

function getConfig() {
    try {
        return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
    } catch {
        return {};
    }
}

function loadSavedConfig() {
    const cfg = getConfig();
    if (cfg.owner) document.getElementById('ghOwner').value = cfg.owner;
    if (cfg.repo) document.getElementById('ghRepo').value = cfg.repo;
    if (cfg.branch) document.getElementById('ghBranch').value = cfg.branch;
    if (cfg.token) document.getElementById('ghToken').value = cfg.token;
}

function bindEvents() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('fc_admin_auth');
        window.location.href = 'login.html';
    });

    document.getElementById('saveGithubConfig').addEventListener('click', () => {
        const cfg = {
            owner: document.getElementById('ghOwner').value.trim(),
            repo: document.getElementById('ghRepo').value.trim(),
            branch: document.getElementById('ghBranch').value.trim() || 'main',
            token: document.getElementById('ghToken').value.trim()
        };
        if (!cfg.owner || !cfg.repo || !cfg.token) {
            showStatus('Completa Usuario, Repositorio y Token de GitHub.', 'error');
            return;
        }
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        showStatus('Configuración guardada. Conectando con GitHub...', 'info');
        loadPortfolioFromGitHub();
    });

    document.getElementById('reloadItemsBtn').addEventListener('click', loadPortfolioFromGitHub);
    document.getElementById('uploadForm').addEventListener('submit', handlePublish);
}

function showStatus(msg, type = 'info') {
    const box = document.getElementById('statusBox');
    box.textContent = msg;
    box.className = 'status-box ' + type;
}

async function githubRequest(path, options = {}) {
    const cfg = getConfig();
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
    const headers = {
        'Authorization': `Bearer ${cfg.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
    };
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || 'Error en la API de GitHub');
    }
    return data;
}

async function loadPortfolioFromGitHub() {
    const cfg = getConfig();
    if (!cfg.owner || !cfg.repo || !cfg.token) return;

    try {
        const fileData = await githubRequest(`data/portfolio.json?ref=${cfg.branch}`);
        currentJsonSha = fileData.sha;
        const decoded = decodeURIComponent(escape(atob(fileData.content.replace(/\n/g, ''))));
        portfolioState = JSON.parse(decoded);
        renderAdminItems();
        showStatus('Conectado correctamente a tu repositorio de GitHub.', 'success');
    } catch (err) {
        showStatus('Error al leer data/portfolio.json: ' + err.message, 'error');
    }
}

async function handlePublish(e) {
    e.preventDefault();
    const cfg = getConfig();
    if (!cfg.owner || !cfg.repo || !cfg.token) {
        showStatus('Primero guarda tu configuración de GitHub arriba.', 'error');
        return;
    }

    const title = document.getElementById('itemTitle').value.trim();
    const category = document.getElementById('itemCategory').value;
    const description = document.getElementById('itemDescription').value.trim();
    const fileInput = document.getElementById('itemFile');
    const externalUrl = document.getElementById('itemUrl').value.trim();
    const featured = document.getElementById('itemFeatured').checked;
    const isHeroVideo = document.getElementById('itemHeroVideo').checked;

    const file = fileInput.files[0];
    if (!file && !externalUrl) {
        showStatus('Selecciona un archivo de imagen/video o pega una URL.', 'error');
        return;
    }

    const btn = document.getElementById('publishBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo a GitHub...';

    try {
        let finalSrc = externalUrl;
        let mediaType = 'image';

        if (file) {
            if (file.size > 24 * 1024 * 1024) {
                throw new Error('GitHub permite archivos directos de hasta 24 MB. Para videos pesados, súbelo a Cloudinary/YouTube y pega el enlace.');
            }
            mediaType = file.type.startsWith('video/') ? 'video' : 'image';
            const cleanName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const repoPath = `assets/uploads/${cleanName}`;
            const base64Content = await fileToBase64(file);

            showStatus('Subiendo archivo multimedia al repositorio...', 'info');
            await githubRequest(repoPath, {
                method: 'PUT',
                body: JSON.stringify({
                    message: `Subir media: ${cleanName}`,
                    content: base64Content,
                    branch: cfg.branch
                })
            });

            finalSrc = repoPath;
        } else if (externalUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i)) {
            mediaType = 'video';
        }

        const newItem = {
            id: Date.now().toString(),
            title,
            category,
            description,
            type: mediaType,
            src: finalSrc,
            featured
        };

        portfolioState.items.unshift(newItem);
        if (isHeroVideo && mediaType === 'video') {
            portfolioState.heroVideo = finalSrc;
        }

        await savePortfolioJson(`Publicar proyecto: ${title}`);

        document.getElementById('uploadForm').reset();
        document.getElementById('itemFeatured').checked = true;
        renderAdminItems();
        showStatus('¡Publicado! En 30-60 segundos se verá reflejado en tu web de GitHub Pages.', 'success');
    } catch (err) {
        showStatus('Error al publicar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> Publicar en GitHub';
    }
}

async function deleteItem(id) {
    if (!confirm('¿Seguro que quieres eliminar este trabajo de tu portafolio?')) return;

    const item = portfolioState.items.find(i => i.id === id);
    if (!item) return;

    showStatus('Eliminando proyecto de GitHub...', 'info');

    try {
        const cfg = getConfig();
        // Si el archivo fue subido dentro de assets/uploads/, también lo borramos del repo
        if (item.src && item.src.startsWith('assets/uploads/')) {
            try {
                const fileMeta = await githubRequest(`${item.src}?ref=${cfg.branch}`);
                await githubRequest(item.src, {
                    method: 'DELETE',
                    body: JSON.stringify({
                        message: `Eliminar archivo: ${item.src}`,
                        sha: fileMeta.sha,
                        branch: cfg.branch
                    })
                });
            } catch (e) {
                console.warn('No se pudo borrar el archivo físico o ya no existía:', e);
            }
        }

        if (portfolioState.heroVideo === item.src) {
            portfolioState.heroVideo = '';
        }

        portfolioState.items = portfolioState.items.filter(i => i.id !== id);
        await savePortfolioJson(`Eliminar proyecto: ${item.title}`);

        renderAdminItems();
        showStatus('Proyecto eliminado correctamente.', 'success');
    } catch (err) {
        showStatus('Error al eliminar: ' + err.message, 'error');
    }
}

async function savePortfolioJson(commitMessage) {
    const cfg = getConfig();
    const jsonString = JSON.stringify(portfolioState, null, 2);
    const base64Json = btoa(unescape(encodeURIComponent(jsonString)));

    const res = await githubRequest('data/portfolio.json', {
        method: 'PUT',
        body: JSON.stringify({
            message: commitMessage,
            content: base64Json,
            sha: currentJsonSha,
            branch: cfg.branch
        })
    });

    currentJsonSha = res.content.sha;
}

function renderAdminItems() {
    const list = document.getElementById('adminItemsList');
    document.getElementById('itemsCount').textContent = portfolioState.items.length;

    if (portfolioState.items.length === 0) {
        list.innerHTML = '<p style="color: var(--secondary);">No hay trabajos publicados todavía. Usa el formulario de la izquierda para subir el primero.</p>';
        return;
    }

    list.innerHTML = portfolioState.items.map(item => {
        const media = item.type === 'video'
            ? `<video src="${item.src}" muted></video>`
            : `<img src="${item.src}" alt="${item.title}">`;

        return `
            <div class="admin-item-card">
                <div class="admin-item-media">
                    ${item.featured ? '<span class="badge-featured">Destacado</span>' : ''}
                    ${media}
                </div>
                <div class="admin-item-body">
                    <div>
                        <small>${item.category}</small>
                        <h4>${item.title}</h4>
                        <p>${item.description || ''}</p>
                    </div>
                    <div class="admin-item-actions">
                        <button type="button" class="btn btn-danger btn-sm" onclick="deleteItem('${item.id}')">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}