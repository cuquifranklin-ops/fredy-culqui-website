document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('bookingForm');
    const serviceSelect = document.getElementById('serviceType');
    const dateInput = document.getElementById('sessionDate');
    const timeSelect = document.getElementById('sessionTime');

    const params = new URLSearchParams(window.location.search);
    const pkg = params.get('paquete');
    if (pkg && serviceSelect) {
        for (const opt of serviceSelect.options) {
            if (opt.value.toLowerCase() === pkg.toLowerCase()) {
                serviceSelect.value = opt.value;
                break;
            }
        }
    }

    if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

    function updateSummary() {
        document.getElementById('sumService').textContent = serviceSelect.value;
        document.getElementById('sumDate').textContent = dateInput.value || 'Por definir';
        document.getElementById('sumTime').textContent = timeSelect.value;
    }

    updateSummary();
    serviceSelect?.addEventListener('change', updateSummary);
    dateInput?.addEventListener('change', updateSummary);
    timeSelect?.addEventListener('change', updateSummary);

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('clientName').value.trim();
        const phone = document.getElementById('clientPhone').value.trim();
        const email = document.getElementById('clientEmail').value.trim();
        const details = document.getElementById('sessionLocation').value.trim();

        const msg = `Hola Fredy, quiero agendar una sesión:%0A` +
            `• *Nombre:* ${encodeURIComponent(name)}%0A` +
            `• *Paquete:* ${encodeURIComponent(serviceSelect.value)}%0A` +
            `• *Fecha:* ${encodeURIComponent(dateInput.value)}%0A` +
            `• *Horario:* ${encodeURIComponent(timeSelect.value)}%0A` +
            `• *Teléfono:* ${encodeURIComponent(phone)}%0A` +
            `• *Correo:* ${encodeURIComponent(email)}` +
            (details ? `%0A• *Idea/Locación:* ${encodeURIComponent(details)}` : '');

        document.getElementById('bookingSuccess').style.display = 'block';
        window.open(`https://wa.me/51967620685?text=${msg}`, '_blank');
    });
});
