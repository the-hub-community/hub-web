function filterHubs() {
        const input = document.getElementById('communitySearch').value.toLowerCase();
        const cards = document.querySelectorAll('.hub-card:not(.static-card)'); // Only filter actual community cards
        const noResults = document.getElementById('noResults');
        let visibleCount = 0;

        for (let card of cards) {
            const name = card.getAttribute('data-name');
            
            // Safety check: only proceed if data-name exists
            if (name && name.includes(input)) {
                card.style.display = "block";
                visibleCount++;
            } else {
                card.style.display = "none";
            }
        }

        // Handle the "No Results" state
        if (noResults) {
            noResults.style.display = (visibleCount === 0 && input !== "") ? "block" : "none";
        }
    }
