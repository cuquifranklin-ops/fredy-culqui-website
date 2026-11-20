// ===== PANEL ADMINISTRADOR PRO (PROYECTOS, FOTOS MÚLTIPLES, VIDEOS Y CATEGORÍAS) =====
if (sessionStorage.getItem('fc_admin_auth') !== 'true') {
    window.location.href = 'login.html';
}

const DEFAULT_CATEGORIES = [
    { slug: 'retratos', name: 'Retratos' },
    { slug: 'artistico', name: 'Artístico' },
    { slug: '15-anos', name: '15 Años' },
    { slug: 'audiovisual', name: 'Audiovisual' }
];

let portfolioState = {
    heroImage: '',
    aboutImage: '',
    heroVideo: '',
    showreelVideo: '',
    categories: [...DEFAULT_CATEGORIES],
    items: []
};
let portfolioJsonSha = null;

function getConfig() {
    return {
        owner: (localStorage.getItem('fc_gh_owner') || '').trim(),
        repo: (localStorage.getItem('fc_gh_repo') || '').trim(),
        branch: (localStorage.getItem('fc_gh_branch') || 'main').trim() || 'main',
        basePath: (localStorage.getItem('fc_gh_base_path') || '').trim().replace(/^\/+|\/+$/g, ''),
        token: (localStorage.getItem('fc_gh_token') || '').trim()
    };
}

function repoPath(relativePath) {
    const { basePath } = getConfig();
    const cleanRel = String(relativePath || '').replace(/^\/+/, '');
    return basePath ? `${basePath}/${cleanRel}` : cleanRel;
}

function showStatus(type, msg) {
    const box = document.getElementById('statusBox');
    if (!box) return;
    box.className = `status-box ${type}`;
    box.innerHTML = msg;
}

function slugifyCategory(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

document.addEventListener('DOMContentLoaded', () => {
    const cfg = getConfig();
    document.getElementById('ghOwner').value = cfg.owner;
    document.getElementById('ghRepo').value = cfg.repo;
    document.getElementById('ghBranch').value = cfg.branch;
    document.getElementById('ghBasePath').value = cfg.basePath;
    document.getElementById('ghToken').value = cfg.token;

    renderCategoryUI();

    if (cfg.owner && cfg.repo && cfg.token) {
        loadPortfolioFromGithub();
    } else {
        loadLocalPortfolioFallback();
    }

    document.getElementById('saveGithubConfig').addEventListener('click', saveGithubConfig);
    document.getElementById('addCategoryBtn').addEventListener('click', handleAddCategory);
    document.getElementById('reloadItemsBtn').addEventListener('click', loadPortfolioFromGithub);
    document.getElementById('uploadForm').addEventListener('submit', handlePublishOrUpdate);
    document.getElementById('cancelEditBtn').addEventListener('click', resetFormMode);
    document.getElementById('itemFile').addEventListener('change', handleFilePreview);
    document.getElementById('adminSearchInput').addEventListener('input', renderAdminItems);
    document.getElementById('adminFilterCategory').addEventListener('change', renderAdminItems);
    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('fc_admin_auth');
        window.location.href = 'login.html';
    });
});

function saveGithubConfig() {
    const owner = document.getElementById('ghOwner').value.trim();
    const repo = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim() || 'main';
    const basePath = document.getElementById('ghBasePath').value.trim().replace(/^\/+|\/+$/g, '');
    const token = document.getElementById('ghToken').value.trim();

    if (!owner || !repo || !token) {
        showStatus('error', 'Completa Usuario, Repositorio y Token de GitHub.');
        return;
    }

    localStorage.setItem('fc_gh_owner', owner);
    localStorage.setItem('fc_gh_repo', repo);
    localStorage.setItem('fc_gh_branch', branch);
    localStorage.setItem('fc_gh_base_path', basePath);
    localStorage.setItem('fc_gh_token', token);

    showStatus('success', 'Configuración guardada. Cargando datos del repositorio...');
    loadPortfolioFromGithub();
}

async function loadLocalPortfolioFallback() {
    try {
        const res = await fetch('data/portfolio.json?v=' + Date.now());
        if (res.ok) {
            const json = await res.json();
            portfolioState = normalizePortfolioData(json);
        }
    } catch (e) {
        // ignore
    }
    renderCategoryUI();
    renderAdminItems();
}

function normalizePortfolioData(raw) {
    const cats = Array.isArray(raw?.categories) && raw.categories.length > 0
        ? raw.categories
        : [...DEFAULT_CATEGORIES];
    return {
        heroImage: raw?.heroImage || '',
        aboutImage: raw?.aboutImage || '',
        heroVideo: raw?.heroVideo || '',
        showreelVideo: raw?.showreelVideo || '',
        categories: cats,
        items: Array.isArray(raw?.items) ? raw.items : []
    };
}

function renderCategoryUI() {
    const selectCat = document.getElementById('itemCategory');
    const filterCat = document.getElementById('adminFilterCategory');
    const chipsBox = document.getElementById('categoryChipsList');

    const prevSelected = selectCat.value;
    selectCat.innerHTML = portfolioState.categories.map(c =>
        `<option value="${escapeAttr(c.slug)}">${escapeHtml(c.name)}</option>`
    ).join('');
    if (prevSelected && portfolioState.categories.some(c => c.slug === prevSelected)) {
        selectCat.value = prevSelected;
    }

    const prevFilter = filterCat.value;
    filterCat.innerHTML = `<option value="all">Todas las categorías</option>` +
        portfolioState.categories.map(c =>
            `<option value="${escapeAttr(c.slug)}">${escapeHtml(c.name)}</option>`
        ).join('');
    if (prevFilter) filterCat.value = prevFilter;

    chipsBox.innerHTML = portfolioState.categories.map(c => `
        <span class="cat-chip">
            ${escapeHtml(c.name)} <span style="color:var(--secondary);">(${escapeHtml(c.slug)})</span>
            <button type="button" title="Eliminar categoría" onclick="removeCategory('${escapeAttr(c.slug)}')">&times;</button>
        </span>
    `).join('');
}

async function handleAddCategory() {
    const nameInput = document.getElementById('newCategoryName');
    const slugInput = document.getElementById('newCategorySlug');
    const name = nameInput.value.trim();
    const slug = slugifyCategory(slugInput.value.trim() || name);

    if (!name || !slug) {
        showStatus('error', 'Escribe un nombre válido para la categoría.');
        return;
    }

    if (portfolioState.categories.some(c => c.slug === slug)) {
        showStatus('error', `Ya existe una categoría con el identificador "${slug}".`);
        return;
    }

    portfolioState.categories.push({ slug, name });
    nameInput.value = '';
    slugInput.value = '';
    renderCategoryUI();
    document.getElementById('itemCategory').value = slug;

    const cfg = getConfig();
    if (cfg.owner && cfg.repo && cfg.token) {
        try {
            showStatus('info', `Guardando categoría "${name}" en GitHub...`);
            await savePortfolioJson(portfolioState, `Agregar categoría: ${name}`);
            showStatus('success', `Categoría "${name}" agregada y publicada.`);
        } catch (err) {
            showStatus('error', 'Categoría agregada localmente, pero falló al guardar en GitHub: ' + err.message);
        }
    } else {
        showStatus('info', `Categoría "${name}" agregada en el panel. Conecta GitHub para publicarla en la web.`);
    }
}

window.removeCategory = async function(slug) {
    if (portfolioState.categories.length <= 1) {
        showStatus('error', 'Debe existir al menos una categoría.');
        return;
    }
    if (!confirm(`¿Eliminar la categoría "${slug}"?`)) return;

    portfolioState.categories = portfolioState.categories.filter(c => c.slug !== slug);
    renderCategoryUI();

    const cfg = getConfig();
    if (cfg.owner && cfg.repo && cfg.token) {
        try {
            showStatus('info', 'Actualizando categorías en GitHub...');
            await savePortfolioJson(portfolioState, `Eliminar categoría: ${slug}`);
            showStatus('success', 'Categoría eliminada.');
        } catch (err) {
            showStatus('error', 'Error al guardar en GitHub: ' + err.message);
        }
    }
};

function handleFilePreview() {
    const files = Array.from(document.getElementById('itemFile').files || []);
    const box = document.getElementById('filePreviewBox');
    box.innerHTML = '';

    files.slice(0, 6).forEach(file => {
        const url = URL.createObjectURL(file);
        if (file.type.startsWith('video/')) {
            const vid = document.createElement('video');
            vid.src = url;
            vid.muted = true;
            box.appendChild(vid);
        } else {
            const img = document.createElement('img');
            img.src = url;
            box.appendChild(img);
        }
    });
}

async function loadPortfolioFromGithub() {
    const { owner, repo, branch, token } = getConfig();
    if (!owner || !repo || !token) {
        showStatus('error', 'Configura primero los datos de GitHub.');
        return;
    }

    showStatus('info', 'Cargando proyectos desde GitHub...');
    const targetPath = repoPath('data/portfolio.json');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${targetPath}?ref=${branch}&t=${Date.now()}`;

    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 404) {
            portfolioState = {
                heroImage: '',
                aboutImage: '',
                heroVideo: '',
                showreelVideo: '',
                categories: [...DEFAULT_CATEGORIES],
                items: []
            };
            portfolioJsonSha = null;
            renderCategoryUI();
            renderAdminItems();
            showStatus('info', 'data/portfolio.json no existe aún; se creará al publicar tu primer proyecto.');
            return;
        }

        if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
        const data = await res.json();
        portfolioJsonSha = data.sha;

        const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
        portfolioState = normalizePortfolioData(JSON.parse(decoded));
        renderCategoryUI();
        renderAdminItems();
        showStatus('success', `Conectado a ${owner}/${repo} (${portfolioState.items.length} proyectos).`);
    } catch (err) {
        showStatus('error', `No se pudo cargar desde GitHub: ${err.message}`);
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadFileToGithub(file) {
    const { owner, repo, branch, token } = getConfig();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = repoPath(`assets/uploads/${Date.now()}_${safeName}`);
    const contentBase64 = await fileToBase64(file);

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Subir archivo: ${safeName}`,
            content: contentBase64,
            branch
        })
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Error subiendo ${file.name}`);
    }

    return `assets/uploads/${filePath.split('/').pop()}`;
}

async function savePortfolioJson(newData, commitMsg) {
    const { owner, repo, branch, token } = getConfig();
    const targetPath = repoPath('data/portfolio.json');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${targetPath}`;

    if (!portfolioJsonSha) {
        const checkRes = await fetch(`${url}?ref=${branch}&t=${Date.now()}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (checkRes.ok) {
            const checkData = await checkRes.json();
            portfolioJsonSha = checkData.sha;
        }
    }

    const jsonString = JSON.stringify(newData, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(jsonString)));

    const body = {
        message: commitMsg || 'Actualizar portfolio.json desde Panel Admin',
        content: base64Content,
        branch
    };
    if (portfolioJsonSha) body.sha = portfolioJsonSha;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Error guardando portfolio.json (${res.status})`);
    }

    const result = await res.json();
    portfolioJsonSha = result.content.sha;
}

async function handlePublishOrUpdate(e) {
    e.preventDefault();
    const { owner, repo, token } = getConfig();
    if (!owner || !repo || !token) {
        showStatus('error', 'Primero configura y guarda tu conexión de GitHub.');
        return;
    }

    const editingId = document.getElementById('editingItemId').value.trim();
    const existingItem = editingId ? portfolioState.items.find(i => String(i.id) === editingId) : null;

    const title = document.getElementById('itemTitle').value.trim();
    const category = document.getElementById('itemCategory').value;
    const projectType = document.getElementById('itemProjectType').value;
    const client = document.getElementById('itemClient').value.trim();
    const year = document.getElementById('itemYear').value.trim() || '2026';
    const description = document.getElementById('itemDescription').value.trim();
    const files = Array.from(document.getElementById('itemFile').files || []);
    const externalUrl = document.getElementById('itemUrl').value.trim();
    const tags = document.getElementById('itemTags').value
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
    const featured = document.getElementById('itemFeatured').checked;
    const setHeroImage = document.getElementById('itemHeroImage').checked;
    const setAboutImage = document.getElementById('itemAboutImage').checked;
    const setHeroVideo = document.getElementById('itemHeroVideo').checked;
    const setHeroShowreel = document.getElementById('itemHeroShowreel').checked;

    if (!title) {
        showStatus('error', 'El título del proyecto es obligatorio.');
        return;
    }
    if (files.length === 0 && !externalUrl && !existingItem?.src) {
        showStatus('error', 'Selecciona al menos una foto/video o ingresa una URL externa.');
        return;
    }

    const publishBtn = document.getElementById('publishBtn');
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        const uploadedUrls = [];
        let detectedType = existingItem?.type || 'image';

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            showStatus('info', `Subiendo archivo ${i + 1} de ${files.length}: ${f.name}...`);
            const uploadedSrc = await uploadFileToGithub(f);
            uploadedUrls.push(uploadedSrc);
            if (i === 0) {
                detectedType = f.type.startsWith('video/') ? 'video' : 'image';
            }
        }

        let primarySrc = existingItem?.src || '';
        let extraGallery = Array.isArray(existingItem?.gallery) ? [...existingItem.gallery] : [];

        if (uploadedUrls.length > 0) {
            primarySrc = uploadedUrls[0];
            if (uploadedUrls.length > 1) {
                extraGallery = [...uploadedUrls.slice(1), ...extraGallery];
            }
        } else if (externalUrl) {
            primarySrc = externalUrl;
            detectedType = /\.(mp4|webm|mov)(\?|$)/i.test(externalUrl) ? 'video' : 'image';
        }

        if (setHeroImage && detectedType === 'image') {
            portfolioState.heroImage = primarySrc;
        }
        if (setAboutImage && detectedType === 'image') {
            portfolioState.aboutImage = primarySrc;
        }
        if (setHeroVideo && detectedType === 'video') {
            portfolioState.heroVideo = primarySrc;
        }
        if (setHeroShowreel && detectedType === 'video') {
            portfolioState.showreelVideo = primarySrc;
        }

        const itemPayload = {
            id: existingItem ? existingItem.id : String(Date.now()),
            title,
            category,
            projectType,
            client,
            year,
            description,
            type: detectedType,
            src: primarySrc,
            gallery: extraGallery,
            tags,
            featured
        };

        if (existingItem) {
            portfolioState.items = portfolioState.items.map(i =>
                String(i.id) === editingId ? itemPayload : i
            );
        } else {
            portfolioState.items.unshift(itemPayload);
        }

        showStatus('info', 'Actualizando data/portfolio.json en GitHub...');
        await savePortfolioJson(
            portfolioState,
            existingItem ? `Actualizar proyecto: ${title}` : `Publicar proyecto: ${title}`
        );

        renderAdminItems();
        resetFormMode();
        showStatus('success', existingItem
            ? `¡Proyecto "${title}" actualizado con éxito!`
            : `¡Proyecto "${title}" publicado en tu portafolio!`
        );
    } catch (err) {
        showStatus('error', 'Error al publicar: ' + err.message);
    } finally {
        publishBtn.disabled = false;
        publishBtn.innerHTML = '<i class="fas fa-rocket"></i> Publicar Proyecto';
    }
}

window.startEditItem = function(id) {
    const item = portfolioState.items.find(i => String(i.id) === String(id));
    if (!item) return;

    document.getElementById('editingItemId').value = item.id;
    document.getElementById('itemTitle').value = item.title || '';
    document.getElementById('itemCategory').value = item.category || portfolioState.categories[0]?.slug || 'retratos';
    document.getElementById('itemProjectType').value = item.projectType || 'Sesión Fotográfica';
    document.getElementById('itemClient').value = item.client || '';
    document.getElementById('itemYear').value = item.year || '2026';
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemUrl').value = /^https?:\/\//i.test(item.src) ? item.src : '';
    document.getElementById('itemTags').value = Array.isArray(item.tags) ? item.tags.join(', ') : '';
    document.getElementById('itemFeatured').checked = Boolean(item.featured);
    document.getElementById('itemHeroImage').checked = Boolean(portfolioState.heroImage && item.src === portfolioState.heroImage);
    document.getElementById('itemAboutImage').checked = Boolean(portfolioState.aboutImage && item.src === portfolioState.aboutImage);
    document.getElementById('itemHeroVideo').checked = Boolean(portfolioState.heroVideo && item.src === portfolioState.heroVideo);
    document.getElementById('itemHeroShowreel').checked = Boolean(portfolioState.showreelVideo && item.src === portfolioState.showreelVideo);

    document.getElementById('formCardTitle').innerHTML = `<i class="fas fa-edit"></i> Editando: ${escapeHtml(item.title)}`;
    document.getElementById('publishBtn').innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';
    document.getElementById('uploadForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function resetFormMode() {
    document.getElementById('uploadForm').reset();
    document.getElementById('editingItemId').value = '';
    document.getElementById('filePreviewBox').innerHTML = '';
    document.getElementById('formCardTitle').innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Subir Nuevo Proyecto';
    document.getElementById('publishBtn').innerHTML = '<i class="fas fa-rocket"></i> Publicar Proyecto';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

window.toggleFeaturedItem = async function(id) {
    const item = portfolioState.items.find(i => String(i.id) === String(id));
    if (!item) return;
    item.featured = !item.featured;
    renderAdminItems();

    const cfg = getConfig();
    if (cfg.owner && cfg.repo && cfg.token) {
        try {
            showStatus('info', 'Actualizando estado destacado...');
            await savePortfolioJson(portfolioState, `Destacar/ocultar proyecto: ${item.title}`);
            showStatus('success', `Estado destacado actualizado para "${item.title}".`);
        } catch (err) {
            showStatus('error', 'Error al guardar: ' + err.message);
        }
    }
};

window.deleteItem = async function(id) {
    if (!confirm('¿Seguro que deseas eliminar este proyecto del portafolio?')) return;

    const item = portfolioState.items.find(i => String(i.id) === String(id));
    portfolioState.items = portfolioState.items.filter(i => String(i.id) !== String(id));
    if (item && portfolioState.heroImage === item.src) {
        portfolioState.heroImage = '';
    }
    if (item && portfolioState.aboutImage === item.src) {
        portfolioState.aboutImage = '';
    }
    if (item && portfolioState.heroVideo === item.src) {
        portfolioState.heroVideo = '';
    }
    if (item && portfolioState.showreelVideo === item.src) {
        portfolioState.showreelVideo = '';
    }
    renderAdminItems();

    const cfg = getConfig();
    if (cfg.owner && cfg.repo && cfg.token) {
        try {
            showStatus('info', 'Eliminando proyecto de portfolio.json...');
            await savePortfolioJson(portfolioState, `Eliminar proyecto: ${item?.title || id}`);
            showStatus('success', 'Proyecto eliminado correctamente.');
        } catch (err) {
            showStatus('error', 'Error al eliminar en GitHub: ' + err.message);
        }
    }
};

function getCategoryDisplayName(slug) {
    const found = portfolioState.categories.find(c => c.slug === slug);
    return found ? found.name : slug;
}

function renderAdminItems() {
    const list = document.getElementById('adminItemsList');
    const countEl = document.getElementById('itemsCount');
    const searchVal = (document.getElementById('adminSearchInput')?.value || '').toLowerCase().trim();
    const filterCat = document.getElementById('adminFilterCategory')?.value || 'all';

    const filtered = portfolioState.items.filter(item => {
        const matchesCat = filterCat === 'all' || item.category === filterCat;
        const haystack = [
            item.title,
            item.description,
            item.client,
            item.projectType,
            ...(Array.isArray(item.tags) ? item.tags : [])
        ].join(' ').toLowerCase();
        const matchesSearch = !searchVal || haystack.includes(searchVal);
        return matchesCat && matchesSearch;
    });

    countEl.textContent = filtered.length;

    if (filtered.length === 0) {
        list.innerHTML = '<p style="color: var(--secondary);">No hay proyectos que coincidan con el filtro.</p>';
        return;
    }

    list.innerHTML = filtered.map(item => {
        const isVideo = item.type === 'video';
        const mediaHtml = isVideo
            ? `<video src="${escapeAttr(item.src)}" muted loop playsinline onmouseover="this.play()" onmouseout="this.pause()"></video>`
            : `<img src="${escapeAttr(item.src)}" alt="${escapeAttr(item.title)}" loading="lazy">`;

        const subLine = [item.projectType, item.client, item.year].filter(Boolean).join(' · ');

        return `
            <div class="admin-item-card">
                <div class="admin-item-media">
                    ${mediaHtml}
                    ${item.featured ? '<span class="badge-featured">DESTACADO</span>' : ''}
                    <span class="badge-type">${isVideo ? 'VIDEO' : 'FOTO'}</span>
                </div>
                <div class="admin-item-body">
                    <div>
                        <small>${escapeHtml(getCategoryDisplayName(item.category))}</small>
                        <h4>${escapeHtml(item.title)}</h4>
                        ${subLine ? `<p style="margin-bottom:0.35rem; color:#d4d4d4;">${escapeHtml(subLine)}</p>` : ''}
                        <p>${escapeHtml(item.description || 'Sin descripción')}</p>
                    </div>
                    <div class="admin-item-actions">
                        <button type="button" class="btn btn-outline btn-sm" onclick="startEditItem('${escapeAttr(item.id)}')">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button type="button" class="btn btn-outline btn-sm" onclick="toggleFeaturedItem('${escapeAttr(item.id)}')">
                            <i class="fas fa-star"></i> ${item.featured ? 'Quitar' : 'Destacar'}
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="deleteItem('${escapeAttr(item.id)}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
