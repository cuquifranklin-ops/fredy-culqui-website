// ===== CARGA DINÁMICA DEL PORTAFOLIO DESDE data/portfolio.json =====
document.addEventListener('DOMContentLoaded', async function() {
    const data = await fetchPortfolioData();

    // 1. Cargar video de fondo en index.html si existe
    const heroVideo = document.getElementById('video-fondo');
    if (heroVideo && data.heroVideo) {
        heroVideo.src = data.heroVideo;
        heroVideo.style.display = 'block';
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

        renderPortfolioGrid(portfolioGrid, data.items);
        initializePortfolioFilters();
        initializePortfolioModal();
        applyUrlFilter();
    }
});

async function fetchPortfolioData() {
    try {
        const res = await fetch('data/portfolio.json?v=' + Date.now());
        if (!res.ok) throw new Error('No se pudo cargar data/portfolio.json');
        return await res.json();
    } catch (err) {
        console.warn('Portafolio vacío o no encontrado:', err);
        return { heroVideo: '', items: [] };
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
                <p style="color: var(--secondary); margin-top: 0.5rem;">Sube tus primeros trabajos desde el Panel Admin.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = listToShow.map(item => {
        const mediaHtml = item.type === 'video'
            ? `<video src="${item.src}" muted loop playsinline onmouseover="this.play()" onmouseout="this.pause()"></video>`
            : `<img src="${item.src}" alt="${item.title}" loading="lazy">`;

        return `
            <div class="gallery-item">
                ${mediaHtml}
                <div class="gallery-overlay">
                    <div class="overlay-content">
                        <span>${formatCategory(item.category)}</span>
                        <h4>${item.title}</h4>
                        <p>${item.description || ''}</p>
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
                <i class="fas fa-folder-open"></i>
                <h3>El portafolio está listo para tus publicaciones</h3>
                <p style="color: var(--secondary); margin: 0.5rem 0 1.25rem;">Aún no has subido fotos o videos desde el panel de administración.</p>
                <a href="login.html" class="btn btn-primary"><i class="fas fa-plus"></i> Subir primer proyecto</a>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => {
        const isVideo = item.type === 'video';
        const mediaTag = isVideo
            ? `<video muted loop preload="metadata" playsinline><source src="${item.src}" type="video/mp4"></video>
               <div class="video-indicator"><i class="fas fa-play"></i> Video</div>`
            : `<img src="${item.src}" alt="${item.title}" loading="lazy">`;

        return `
            <div class="portfolio-item ${isVideo ? 'video-item' : ''}" data-category="${item.category}" data-id="${item.id}">
                <div class="portfolio-image">
                    ${mediaTag}
                    <div class="portfolio-overlay">
                        <div class="overlay-content">
                            <span class="category">${formatCategory(item.category)}</span>
                            <h3>${item.title}</h3>
                            <p>${item.description || ''}</p>
                            <button class="view-btn-expand" aria-label="Ampliar"><i class="fas fa-expand"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Reproducir video al pasar el mouse
    container.querySelectorAll('.video-item').forEach(card => {
        const vid = card.querySelector('video');
        if (!vid) return;
        card.addEventListener('mouseenter', () => vid.play().catch(() => {}));
        card.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });
    });
}

function formatCategory(cat) {
    const map = {
        'retratos': 'Retratos',
        'artistico': 'Artístico',
        '15-anos': '15 Años',
        'audiovisual': 'Audiovisual'
    };
    return map[cat] || cat;
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

        modalMedia.innerHTML = '';
        if (img) {
            modalMedia.innerHTML = `<img src="${img.src}" alt="">`;
        } else if (vidSource) {
            modalMedia.innerHTML = `<video controls autoplay playsinline><source src="${vidSource.src}" type="video/mp4"></video>`;
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