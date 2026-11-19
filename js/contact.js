document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contactForm');
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('contactName').value.trim();
        const email = document.getElementById('contactEmail').value.trim();
        const subject = document.getElementById('contactSubject').value.trim();
        const message = document.getElementById('contactMessage').value.trim();

        document.getElementById('contactFeedback').style.display = 'block';
        const mailto = `mailto:fredyculqui@gmail.com?subject=${encodeURIComponent(subject + ' - ' + name)}&body=${encodeURIComponent(message + '\n\nContacto: ' + name + ' (' + email + ')')}`;
        window.location.href = mailto;
        form.reset();
    });
});
