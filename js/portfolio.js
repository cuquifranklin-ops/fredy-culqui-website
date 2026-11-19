// ===== CARGA DINÁMICA DEL PORTAFOLIO DESDE data/portfolio.json =====
let PORTFOLIO_CATEGORIES_MAP = {
    'retratos': 'Retratos',
    'artistico': 'Artístico',
    '15-anos': '15 Años',
    'audiovisual': 'Audiovisual'
};

document.addEventListener('DOMContentLoaded', async function() {
    const data = await fetchPortfolioData();
    buildCategoryMap(data.categories);

    // 0a. Cargar foto principal de portada en index.html si existe
    const heroMainImage = document.getElementById('heroMainImage');
    const heroBgImage = document.getElementById('heroBgImage');
    if (data.heroImage) {
        if (heroMainImage) heroMainImage.src = data.heroImage;
        if (heroBgImage) heroBgImage.style.backgroundImage = `url('${data.heroImage}')`;
    }

    // 0b. Cargar foto de "Sobre Mí" en sobre-mi.html si existe
    const aboutProfileImage = document.getElementById('aboutProfileImage');
    if (aboutProfileImage && data.aboutImage) {
        aboutProfileImage.src = data.aboutImage;
    }

    // 1. Cargar video de fondo en index.html si existe
    const heroVideo = document.getElementById('video-fondo');
    if (heroVideo && data.heroVideo) {
        heroVideo.src = data.heroVideo;
        heroVideo.style.display = 'block';
    }

    // 1b. Cargar video showreel de filmmaker en la tarjeta secundaria del Hero
    const showreelVideo = document.getElementById('heroShowreelVideo');
    const showreelPlaceholder = document.getElementById('heroVideoPlaceholder');
    const showreelSrc = data.showreelVideo || '';
    if (showreelVideo && showreelSrc) {
        showreelVideo.src = showreelSrc;
        showreelVideo.style.display = 'block';
        if (showreelPlaceholder) showreelPlaceholder.style.display = 'none';
        showreelVideo.play().catch(() => {});
    }

    // 2. Cargar trabajos destacados en index.html
    const featuredGallery = document.getElementById('featuredGallery');
    if (featuredGallery) {
        renderFeaturedItems(featuredGallery, data.items);
    }

    // 3. Cargar portafolio completo en portafolio.html
    const portfolioGrid = document.getElementById('portfolioGrid');
    if (portfolioGrid) {
        const statEl = document.getElementById('totalProjectsStat');
        if (statEl) statEl.textContent = data.items.length;

        renderCategoryFilterButtons(data.categories);
        renderPortfolioGrid(portfolioGrid, data.items);
        initializePortfolioFilters();
        initializePortfolioModal();
        applyUrlFilter();
    }
});

function buildCategoryMap(categories) {
    if (Array.isArray(categories) && categories.length > 0) {
        PORTFOLIO_CATEGORIES_MAP = {};
        categories.forEach(cat => {
            if (cat && cat.slug) {
                PORTFOLIO_CATEGORIES_MAP[cat.slug] = cat.name || cat.slug;
            }
        });
    }
}

function renderCategoryFilterButtons(categories) {
    const filterGroup = document.querySelector('#portfolioFilters .filter-group');
    if (!filterGroup || !Array.isArray(categories) || categories.length === 0) return;

    const customButtonsHtml = categories.map(cat => `
        <button class="filter-btn filter-category" data-category="${escapeAttr(cat.slug)}">
            ${escapeHtml(cat.name)}
        </button>
    `).join('');

    filterGroup.innerHTML = `
        <button class="filter-btn filter-category active" data-category="all">
            <i class="fas fa-th"></i> Todo
        </button>
        ${customButtonsHtml}
    `;
}

async function fetchPortfolioData() {
    try {
        const res = await fetch('data/portfolio.json?v=' + Date.now());
        if (!res.ok) throw new Error('No se pudo cargar data/portfolio.json');
        const json = await res.json();
        return {
            heroImage: json.heroImage || '',
            aboutImage: json.aboutImage || '',
            heroVideo: json.heroVideo || '',
            showreelVideo: json.showreelVideo || '',
            categories: Array.isArray(json.categories) && json.categories.length > 0 ? json.categories : [
                { slug: 'retratos', name: 'Retratos' },
                { slug: 'artistico', name: 'Artístico' },
                { slug: '15-anos', name: '15 Años' },
                { slug: 'audiovisual', name: 'Audiovisual' }
            ],
            items: Array.isArray(json.items) ? json.items : []
        };
    } catch (err) {
        console.warn('Portafolio vacío o no encontrado:', err);
        return {
            heroImage: '',
            aboutImage: '',
            heroVideo: '',
            showreelVideo: '',
            categories: [
                { slug: 'retratos', name: 'Retratos' },
                { slug: 'artistico', name: 'Artístico' },
                { slug: '15-anos', name: '15 Años' },
                { slug: 'audiovisual', name: 'Audiovisual' }
            ],
            items: []
        };
    }
}

function renderFeaturedItems(container, items) {
    const featured = items.filter(item => item.featured).slice(0, 6);
    const listToShow = featured.length > 0 ? featured : items.slice(0, 3);

    if (listToShow.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-camera-retro"></i>
                <h3>Próximamente nuevos proyectos</h3>
                <p style="color: var(--secondary); margin-top: 0.5rem;">Estamos preparando nuestra nueva colección visual.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = listToShow.map(item => {
        const mediaHtml = item.type === 'video'
            ? `<video src="${escapeAttr(item.src)}" muted loop playsinline onmouseover="this.play()" onmouseout="this.pause()"></video>`
            : `<img src="${escapeAttr(item.src)}" alt="${escapeAttr(item.title)}" loading="lazy">`;

        const metaParts = [formatCategory(item.category), item.projectType, item.year].filter(Boolean);

        return `
            <div class="gallery-item">
                ${mediaHtml}
                <div class="gallery-overlay">
                    <div class="overlay-content">
                        <span>${escapeHtml(metaParts.join(' · '))}</span>
                        <h4>${escapeHtml(item.title)}</h4>
                        <p>${escapeHtml(item.description || '')}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderPortfolioGrid(container, items) {
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-camera"></i>
                <h3>Galería en actualización</h3>
                <p style="color: var(--secondary); margin-top: 0.5rem;">Pronto publicaremos nuevas sesiones fotográficas y producciones audiovisuales.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => {
        const isVideo = item.type === 'video';
        const galleryArr = Array.isArray(item.gallery) ? item.gallery : [];
        const allMedia = [item.src, ...galleryArr].filter(Boolean);
        const mediaTag = isVideo
            ? `<video muted loop preload="metadata" playsinline><source src="${escapeAttr(item.src)}" type="video/mp4"></video>
               <div class="video-indicator"><i class="fas fa-play"></i> Video</div>`
            : `<img src="${escapeAttr(item.src)}" alt="${escapeAttr(item.title)}" loading="lazy">`;

        const extraBadge = allMedia.length > 1
            ? `<span class="video-indicator" style="left:auto; right:12px;"><i class="fas fa-images"></i> ${allMedia.length}</span>`
            : '';

        const subtitleParts = [item.projectType, item.client, item.year].filter(Boolean).join(' · ');

        return `
            <div class="portfolio-item ${isVideo ? 'video-item' : ''}"
                 data-category="${escapeAttr(item.category)}"
                 data-id="${escapeAttr(item.id)}"
                 data-gallery='${escapeAttr(JSON.stringify(allMedia))}'>
                <div class="portfolio-image">
                    ${mediaTag}
                    ${extraBadge}
                    <div class="portfolio-overlay">
                        <div class="overlay-content">
                            <span class="category">${escapeHtml(formatCategory(item.category))}</span>
                            <h3>${escapeHtml(item.title)}</h3>
                            <p>${escapeHtml(item.description || subtitleParts || '')}</p>
                            <button class="view-btn-expand" aria-label="Ampliar"><i class="fas fa-expand"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.video-item').forEach(card => {
        const vid = card.querySelector('video');
        if (!vid) return;
        card.addEventListener('mouseenter', () => vid.play().catch(() => {}));
        card.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });
    });
}

function formatCategory(cat) {
    return PORTFOLIO_CATEGORIES_MAP[cat] || cat || 'General';
}

function initializePortfolioFilters() {
    const filterButtons = document.querySelectorAll('.filter-category');
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    const viewButtons = document.querySelectorAll('.view-btn');
    const portfolioGrid = document.getElementById('portfolioGrid');

    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            portfolioItems.forEach(item => {
                const itemCategory = item.getAttribute('data-category');
                item.style.display = (category === 'all' || itemCategory === category) ? 'block' : 'none';
            });
        });
    });

    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            const viewType = this.getAttribute('data-view');
            viewButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            if (portfolioGrid) {
                portfolioGrid.classList.remove('grid-view', 'masonry-view');
                portfolioGrid.classList.add(viewType + '-view');
            }
        });
    });
}

function applyUrlFilter() {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('filter');
    if (filter) {
        const targetBtn = document.querySelector(`.filter-category[data-category="${filter}"]`);
        if (targetBtn) targetBtn.click();
    }
}

function initializePortfolioModal() {
    const modal = document.getElementById('imageModal');
    const modalClose = document.getElementById('modalClose');
    const modalPrev = document.getElementById('modalPrev');
    const modalNext = document.getElementById('modalNext');
    const modalMedia = document.getElementById('modalMedia');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalCategory = document.getElementById('modalCategory');

    if (!modal) return;

    let currentItems = [];
    let currentIndex = 0;

    document.querySelectorAll('.portfolio-item').forEach(item => {
        item.addEventListener('click', function() {
            currentItems = Array.from(document.querySelectorAll('.portfolio-item')).filter(el => el.style.display !== 'none');
            currentIndex = currentItems.indexOf(this);
            showModalItem(currentItems[currentIndex]);
        });
    });

    function showModalItem(item) {
        if (!item) return;
        const img = item.querySelector('img');
        const vidSource = item.querySelector('video source');
        let galleryList = [];
        try {
            galleryList = JSON.parse(item.getAttribute('data-gallery') || '[]');
        } catch (e) {
            galleryList = [];
        }

        modalMedia.innerHTML = '';
        if (img) {
            modalMedia.innerHTML = `<img src="${escapeAttr(img.src)}" alt="">`;
            if (galleryList.length > 1) {
                const thumbsHtml = galleryList.map((srcUrl, idx) => `
                    <img src="${escapeAttr(srcUrl)}"
                         class="modal-thumb-item"
                         data-src="${escapeAttr(srcUrl)}"
                         style="width:54px; height:54px; object-fit:cover; border-radius:6px; cursor:pointer; border:2px solid ${idx === 0 ? 'var(--accent)' : 'rgba(255,255,255,0.2)'};">
                `).join('');
                const thumbsBar = document.createElement('div');
                thumbsBar.style.cssText = 'display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap; margin-top:0.85rem;';
                thumbsBar.innerHTML = thumbsHtml;
                thumbsBar.querySelectorAll('.modal-thumb-item').forEach(thumb => {
                    thumb.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        const mainImg = modalMedia.querySelector('img');
                        if (mainImg) mainImg.src = thumb.getAttribute('data-src');
                        thumbsBar.querySelectorAll('.modal-thumb-item').forEach(t => t.style.borderColor = 'rgba(255,255,255,0.2)');
                        thumb.style.borderColor = 'var(--accent)';
                    });
                });
                modalMedia.appendChild(thumbsBar);
            }
        } else if (vidSource) {
            modalMedia.innerHTML = `<video controls autoplay playsinline><source src="${escapeAttr(vidSource.src)}" type="video/mp4"></video>`;
        }

        modalTitle.textContent = item.querySelector('h3')?.textContent || '';
        modalDescription.textContent = item.querySelector('p')?.textContent || '';
        modalCategory.textContent = item.querySelector('.category')?.textContent || '';

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        const v = modalMedia.querySelector('video');
        if (v) v.pause();
    }

    modalClose?.addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    modalPrev?.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + currentItems.length) % currentItems.length;
        showModalItem(currentItems[currentIndex]);
    });
    modalNext?.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % currentItems.length;
        showModalItem(currentItems[currentIndex]);
    });
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
