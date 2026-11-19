// ========================================
// CINEZI — MOVIE JOURNAL
// ========================================

// Masukkan TMDB Read Access Token BARU milikmu.
const API_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjNGNlZGY2MjM0NmE1ZWFkZDY1ZmM1YWM5MWM2NWQ4YSIsIm5iZiI6MTc5Mzc1NzM2MS44NjcsInN1YiI6IjZhZWE5MGIxMmNhY2ViZjBkYzc4ZTA2YiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.c57W_gd7oNFpJyEIdJ1FTNB5F3izIOs7wbK0S2KuItU";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_URL = "https://image.tmdb.org/t/p/w1280";

const headers = {
    accept: "application/json",
    Authorization: `Bearer ${API_TOKEN}`
};

let currentMovies = [];
let currentPage = 1;
let currentMovie = null;
let selectedRating = 0;
let selectedGenre = "";
let currentSearch = "";
let currentSort = "popular";
let activeWatchTab = "want";
let searchTimeout;

const genreNames = {
    28: "Action", 12: "Adventure", 16: "Animation",
    35: "Comedy", 80: "Crime", 99: "Documentary",
    18: "Drama", 10751: "Family", 14: "Fantasy",
    36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
    10770: "TV Movie", 53: "Thriller", 10752: "War",
    37: "Western"
};

const ratingLabels = {
    1: "Terrible",
    2: "Not Good",
    3: "Average",
    4: "Great",
    5: "Masterpiece"
};

const communityMembers = [
    {
        name: "Nadia",
        genres: ["Drama", "Romance", "Fantasy"],
        description: "Loves emotional stories and beautiful cinematography."
    },
    {
        name: "Raka",
        genres: ["Action", "Sci-Fi", "Thriller"],
        description: "A fan of plot twists and mind-bending stories."
    },
    {
        name: "Dimas",
        genres: ["Horror", "Mystery", "Thriller"],
        description: "Always searching for hidden meanings in movies."
    },
    {
        name: "Alya",
        genres: ["Animation", "Fantasy", "Adventure"],
        description: "Enjoys imaginative worlds and creative storytelling."
    },
    {
        name: "Farel",
        genres: ["Drama", "Crime", "Mystery"],
        description: "Likes realistic stories and complex characters."
    },
    {
        name: "Mira",
        genres: ["Romance", "Comedy", "Drama"],
        description: "Believes every great movie leaves a feeling."
    }
];


// ========================================
// LOCAL STORAGE
// ========================================

function getStorage(key, fallback = []) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function saveStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function getWatchlist() {
    return getStorage("cineziWatchlist");
}

function getRatings() {
    return getStorage("cineziRatings");
}


// ========================================
// HELPERS
// ========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getPoster(path) {
    return path
        ? IMAGE_URL + path
        : "https://placehold.co/500x750/242821/d3aa70?text=No+Poster";
}

function getYear(movie) {
    return (movie.release_date || movie.first_air_date || "").slice(0, 4)
        || "Unknown year";
}

function getMovieTitle(movie) {
    return movie.title || movie.name || "Untitled";
}

function getMovieType(movie) {
    return movie.media_type === "tv" ? "TV SERIES" : "MOVIE";
}

function formatDate(date) {
    return new Date(date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}


// ========================================
// TMDB API
// ========================================

async function apiRequest(endpoint) {
    const response = await fetch(`${BASE_URL}${endpoint}`, { headers });

    if (!response.ok) {
        throw new Error(`TMDB request failed: ${response.status}`);
    }

    return response.json();
}


// ========================================
// LOAD MOVIES
// ========================================

async function loadMovies(reset = true) {
    const grid = document.getElementById("movieGrid");
    const loadMore = document.getElementById("loadMoreBtn");

    if (reset) {
        currentPage = 1;
        currentMovies = [];
        grid.innerHTML = `<div class="loading">Finding films for you...</div>`;
    }

    loadMore.disabled = true;
    loadMore.textContent = "Loading...";

    try {
        let endpoint;

        if (currentSearch) {
            endpoint = `/search/multi?query=${encodeURIComponent(currentSearch)}&language=id-ID&page=${currentPage}`;
        } else if (currentSort === "rating") {
            endpoint = `/movie/top_rated?language=id-ID&page=${currentPage}`;
        } else if (currentSort === "newest") {
            endpoint = `/discover/movie?language=id-ID&sort_by=release_date.desc&page=${currentPage}&include_adult=false`;
        } else if (selectedGenre) {
            endpoint = `/discover/movie?language=id-ID&with_genres=${selectedGenre}&sort_by=popularity.desc&page=${currentPage}`;
        } else {
            endpoint = `/trending/movie/week?language=id-ID&page=${currentPage}`;
        }

        const data = await apiRequest(endpoint);

        let results = (data.results || []).filter(item =>
            item.media_type !== "person" &&
            (item.media_type !== "tv" || !currentSearch)
        );

        // If search has no movie result, try searching for a person.
        if (currentSearch && results.length === 0) {
            const people = await apiRequest(
                `/search/person?query=${encodeURIComponent(currentSearch)}&language=id-ID`
            );

            const person = people.results?.[0];

            if (person) {
                const credits = await apiRequest(
                    `/person/${person.id}/movie_credits?language=id-ID`
                );

                results = (credits.cast || []).map(movie => ({
                    ...movie,
                    media_type: "movie"
                }));
            }
        }

        currentMovies = reset
            ? results
            : [...currentMovies, ...results];

        if (currentSort === "rating") {
            currentMovies.sort((a, b) =>
                (b.vote_average || 0) - (a.vote_average || 0)
            );
        }

        if (currentSort === "newest") {
            currentMovies.sort((a, b) =>
                new Date(b.release_date || 0) -
                new Date(a.release_date || 0)
            );
        }

        renderMovies(currentMovies);
        renderCommunity();

    } catch (error) {
        console.error(error);

        grid.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load movies</h3>
                <p>Check your TMDB token and internet connection.</p>
            </div>
        `;
    } finally {
        loadMore.disabled = false;
        loadMore.textContent = "Load More Movies ↓";
    }
}


// ========================================
// MOVIE CARDS
// ========================================

function renderMovies(movies) {
    const grid = document.getElementById("movieGrid");

    if (!movies.length) {
        grid.innerHTML = `
            <div class="empty-state">
                No movies found. Try another title.
            </div>
        `;
        return;
    }

    grid.innerHTML = movies.map(movie => {
        const id = Number(movie.id);
        const saved = getWatchlist().some(item => item.id === id);
        const title = getMovieTitle(movie);
        const genres = (movie.genre_ids || [])
            .slice(0, 2)
            .map(id => genreNames[id] || "")
            .filter(Boolean)
            .join(" · ");

        return `
            <article class="movie-card">
                <div class="poster-wrap" data-open-movie="${id}">
                    <img src="${getPoster(movie.poster_path)}"
                        alt="${escapeHTML(title)}" loading="lazy">

                    <div class="movie-score">
                        ★ ${Number(movie.vote_average || 0).toFixed(1)}
                    </div>
                </div>

                <div class="movie-info">
                    <h3>${escapeHTML(title)}</h3>
                    <p>${getYear(movie)}</p>

                    <div class="movie-meta">
                        <span>${getMovieType(movie)}</span>
                        <span>${escapeHTML(genres || "Cinema")}</span>
                    </div>
                </div>

                <div class="movie-card-actions">
                    <button data-open-movie="${id}">Details ↗</button>
                    <button
                        class="${saved ? "saved" : ""}"
                        data-watch-action="toggle"
                        data-id="${id}">
                        ${saved ? "♥ Saved" : "♡ Watchlist"}
                    </button>
                </div>
            </article>
        `;
    }).join("");
}


// Movie grid event delegation
document.getElementById("movieGrid").addEventListener("click", event => {
    const watchButton = event.target.closest("[data-watch-action]");
    const detailButton = event.target.closest("[data-open-movie]");

    if (watchButton) {
        event.stopPropagation();
        const id = Number(watchButton.dataset.id);
        const movie = currentMovies.find(item => Number(item.id) === id);

        if (movie) toggleWatchlist(movie);
        return;
    }

    if (detailButton) {
        showMovieDetail(Number(detailButton.dataset.openMovie));
    }
});


// ========================================
// WATCHLIST
// ========================================

function toggleWatchlist(movie) {
    const list = getWatchlist();
    const id = Number(movie.id);
    const existing = list.findIndex(item => Number(item.id) === id);

    if (existing >= 0) {
        list.splice(existing, 1);
    } else {
        list.unshift({
            id,
            title: getMovieTitle(movie),
            poster_path: movie.poster_path,
            release_date: movie.release_date || movie.first_air_date || "",
            vote_average: movie.vote_average || 0,
            genre_ids: movie.genre_ids || [],
            status: "want",
            addedAt: new Date().toISOString()
        });
    }

    saveStorage("cineziWatchlist", list);
    renderWatchlist();
    renderMovies(currentMovies);

    // Refresh detail button state if the selected movie is visible.
    if (currentMovie && Number(currentMovie.id) === id) {
        renderDetailWatchButton();
    }
}

function updateWatchlistStatus(id, status) {
    const list = getWatchlist();
    const movie = list.find(item => Number(item.id) === Number(id));

    if (!movie) return;

    movie.status = status;
    saveStorage("cineziWatchlist", list);
    renderWatchlist();
    renderMovies(currentMovies);

    if (currentMovie && Number(currentMovie.id) === Number(id)) {
        renderDetailWatchButton();
    }
}

function removeFromWatchlist(id) {
    const list = getWatchlist().filter(
        item => Number(item.id) !== Number(id)
    );

    saveStorage("cineziWatchlist", list);
    renderWatchlist();
    renderMovies(currentMovies);

    if (currentMovie && Number(currentMovie.id) === Number(id)) {
        renderDetailWatchButton();
    }
}

function renderWatchlist() {
    const list = getWatchlist();
    const want = list.filter(item => item.status !== "watched");
    const watched = list.filter(item => item.status === "watched");

    document.getElementById("watchlistCount").textContent = list.length;
    document.getElementById("wantCount").textContent = want.length;
    document.getElementById("watchedCount").textContent = watched.length;

    const currentList = activeWatchTab === "want" ? want : watched;
    const grid = document.getElementById("watchlistGrid");

    if (!currentList.length) {
        grid.innerHTML = `
            <div class="watchlist-empty">
                <span>♡</span>
                <h3>${activeWatchTab === "want"
                    ? "Your watchlist is waiting."
                    : "No watched films yet."}</h3>
                <p>${activeWatchTab === "want"
                    ? "Save films from Discover and they will appear here."
                    : "Move a film here when you've watched it."}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = currentList.map(movie => `
        <article class="watch-card">
            <img src="${getPoster(movie.poster_path)}"
                alt="${escapeHTML(movie.title)}" loading="lazy">

            <div class="watch-card-info">
                <h3>${escapeHTML(movie.title)}</h3>
                <p>${getYear(movie)}</p>
                <p class="watch-rating">★ ${Number(movie.vote_average || 0).toFixed(1)}</p>

                <div class="watch-card-actions">
                    <button data-watch-detail="${movie.id}">Details</button>

                    ${activeWatchTab === "want" ? `
                        <button data-mark-watched="${movie.id}">Watched ✓</button>
                    ` : `
                        <button data-mark-want="${movie.id}">Move back</button>
                    `}

                    <button data-remove-watch="${movie.id}">Remove</button>
                </div>
            </div>
        </article>
    `).join("");
}

document.querySelectorAll("[data-watch-tab]").forEach(button => {
    button.addEventListener("click", () => {
        activeWatchTab = button.dataset.watchTab;

        document.querySelectorAll("[data-watch-tab]").forEach(tab => {
            tab.classList.toggle("active", tab === button);
        });

        renderWatchlist();
    });
});

document.getElementById("watchlistGrid").addEventListener("click", event => {
    const detailButton = event.target.closest("[data-watch-detail]");
    const watchedButton = event.target.closest("[data-mark-watched]");
    const wantButton = event.target.closest("[data-mark-want]");
    const removeButton = event.target.closest("[data-remove-watch]");

    if (detailButton) {
        showMovieDetail(Number(detailButton.dataset.watchDetail));
    }

    if (watchedButton) {
        updateWatchlistStatus(watchedButton.dataset.markWatched, "watched");
    }

    if (wantButton) {
        updateWatchlistStatus(wantButton.dataset.markWant, "want");
    }

    if (removeButton) {
        removeFromWatchlist(removeButton.dataset.removeWatch);
    }
});


// ========================================
// MOVIE DETAILS
// ========================================

async function showMovieDetail(movieId) {
    const detail = document.getElementById("detailContent");

    detail.innerHTML = `<div class="loading">Loading movie details...</div>`;

    try {
        const movie = await apiRequest(
            `/movie/${movieId}?language=id-ID&append_to_response=credits,videos,release_dates`
        );

        currentMovie = movie;

        const savedRating = getRatings().find(
            item => Number(item.movieId) === Number(movie.id)
        );

        selectedRating = savedRating?.rating || 0;

        document.getElementById("ratingMovieName").textContent =
            `Your rating for ${movie.title}`;

        document.getElementById("ratingLabel").textContent =
            selectedRating ? ratingLabels[selectedRating] : "Your rating will appear here.";

        highlightStars(selectedRating);

        const director = movie.credits?.crew?.find(
            person => person.job === "Director"
        );

        const cast = movie.credits?.cast
            ?.slice(0, 6)
            .map(person => person.name)
            .join(", ") || "Not available";

        const trailer = movie.videos?.results?.find(video =>
            video.site === "YouTube" &&
            video.type === "Trailer" &&
            video.official
        ) || movie.videos?.results?.find(video =>
            video.site === "YouTube" &&
            video.type === "Trailer"
        );

        const certification = movie.release_dates?.results
            ?.find(item => item.iso_3166_1 === "ID")
            ?.release_dates?.find(item => item.certification)?.certification;

        const watchButton = getWatchlist().some(
            item => Number(item.id) === Number(movie.id)
        );

        detail.innerHTML = `
            <div class="detail-card">
                <img class="detail-poster"
                    src="${getPoster(movie.poster_path)}"
                    alt="${escapeHTML(movie.title)}">

                <div class="detail-content">
                    <p class="section-label">MOVIE PROFILE</p>
                    <h3>${escapeHTML(movie.title)}</h3>

                    <div class="detail-meta">
                        <span>★ ${Number(movie.vote_average || 0).toFixed(1)} / 10</span>
                        <span>${escapeHTML(movie.release_date || "Unknown date")}</span>
                        <span>${movie.runtime || "?"} min</span>
                        <span>${escapeHTML(certification || "Rating unavailable")}</span>
                    </div>

                    <p class="detail-overview">
                        ${escapeHTML(movie.overview || "No overview available.")}
                    </p>

                    <div class="detail-meta">
                        ${(movie.genres || []).map(genre =>
                            `<span>${escapeHTML(genre.name)}</span>`
                        ).join("")}
                    </div>

                    <div class="detail-credits">
                        <p><strong>Director:</strong> ${escapeHTML(director?.name || "Unknown")}</p>
                        <p><strong>Cast:</strong> ${escapeHTML(cast)}</p>
                    </div>

                    <div class="detail-actions">
                        <button class="btn btn-primary" id="detailWatchBtn">
                            ${watchButton ? "♥ In Watchlist" : "♡ Add to Watchlist"}
                        </button>
                        <a href="#ratingSection" class="btn btn-outline">Rate this film</a>
                    </div>

                    ${trailer ? `
                        <iframe
                            class="trailer-frame"
                            src="https://www.youtube.com/embed/${encodeURIComponent(trailer.key)}"
                            title="Official movie trailer"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen>
                        </iframe>
                    ` : `
                        <p class="muted" style="margin-top:18px;">Official trailer unavailable.</p>
                    `}
                </div>
            </div>
        `;

        document.getElementById("detailWatchBtn").addEventListener("click", () => {
            toggleWatchlist({
                ...movie,
                media_type: "movie",
                genre_ids: (movie.genres || []).map(genre => genre.id)
            });
        });

        renderRatingHistogram();

        document.getElementById("movieDetail")
            .scrollIntoView({ behavior: "smooth", block: "start" });

    } catch (error) {
        console.error(error);
        detail.innerHTML = `
            <div class="empty-state">
                Unable to load movie details. Please try again.
            </div>
        `;
    }
}

function renderDetailWatchButton() {
    if (!currentMovie) return;

    const button = document.getElementById("detailWatchBtn");
    if (!button) return;

    const saved = getWatchlist().some(
        item => Number(item.id) === Number(currentMovie.id)
    );

    button.textContent = saved ? "♥ In Watchlist" : "♡ Add to Watchlist";
}


// ========================================
// GENRES
// ========================================

async function loadGenres() {
    const select = document.getElementById("genreFilter");

    try {
        const data = await apiRequest("/genre/movie/list?language=id-ID");

        select.innerHTML = `
            <option value="">All Genres</option>
            ${(data.genres || []).map(genre => `
                <option value="${genre.id}">${escapeHTML(genre.name)}</option>
            `).join("")}`;

    } catch (error) {
        console.error("Genre loading failed:", error);
    }
}


// ========================================
// SEARCH AND FILTERS
// ========================================

document.getElementById("searchInput").addEventListener("input", event => {
    clearTimeout(searchTimeout);
    currentSearch = event.target.value.trim();

    searchTimeout = setTimeout(() => {
        loadMovies();
    }, 450);
});

document.getElementById("searchBtn").addEventListener("click", () => {
    currentSearch = document.getElementById("searchInput").value.trim();
    loadMovies();
});

document.getElementById("searchInput").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        currentSearch = event.target.value.trim();
        loadMovies();
    }
});

document.getElementById("genreFilter").addEventListener("change", event => {
    selectedGenre = event.target.value;
    currentSearch = "";
    document.getElementById("searchInput").value = "";
    loadMovies();
});

document.getElementById("sortFilter").addEventListener("change", event => {
    currentSort = event.target.value;
    currentSearch = "";
    document.getElementById("searchInput").value = "";
    loadMovies();
});

document.getElementById("loadMoreBtn").addEventListener("click", () => {
    currentPage++;
    loadMovies(false);
});


// ========================================
// STAR RATINGS
// ========================================

document.querySelectorAll("#starRating button").forEach(button => {
    button.addEventListener("mouseenter", () => {
        highlightStars(Number(button.dataset.value));
    });

    button.addEventListener("click", () => {
        if (!currentMovie) {
            alert("Choose a movie first!");
            return;
        }

        selectedRating = Number(button.dataset.value);

        const ratings = getRatings();
        const existing = ratings.findIndex(
            item => Number(item.movieId) === Number(currentMovie.id)
        );

        const newRating = {
            movieId: currentMovie.id,
            movieTitle: currentMovie.title,
            rating: selectedRating,
            date: new Date().toISOString()
        };

        if (existing >= 0) {
            ratings[existing] = newRating;
        } else {
            ratings.push(newRating);
        }

        saveStorage("cineziRatings", ratings);

        highlightStars(selectedRating);
        document.getElementById("ratingLabel").textContent =
            ratingLabels[selectedRating];

        renderRatingHistogram();
        renderCommunity();
    });
});

document.getElementById("starRating").addEventListener("mouseleave", () => {
    highlightStars(selectedRating);
});

function highlightStars(value) {
    document.querySelectorAll("#starRating button").forEach(button => {
        button.classList.toggle(
            "active",
            Number(button.dataset.value) <= value
        );
    });
}

function renderRatingHistogram() {
    const ratings = getRatings().filter(item =>
        currentMovie && Number(item.movieId) === Number(currentMovie.id)
    );

    const average = ratings.length
        ? ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length
        : 0;

    document.getElementById("ratingAverage").textContent =
        average.toFixed(1);

    document.getElementById("ratingBars").innerHTML =
        [5, 4, 3, 2, 1].map(star => {
            const count = ratings.filter(item => item.rating === star).length;
            const percent = ratings.length ? count / ratings.length * 100 : 0;

            return `
                <div class="rating-bar">
                    <span>${star} ★</span>
                    <div class="bar-track">
                        <div class="bar-fill" style="width:${percent}%"></div>
                    </div>
                    <span>${count}</span>
                </div>
            `;
        }).join("");
}


// ========================================
// REVIEWS
// ========================================

document.getElementById("submitReview").addEventListener("click", () => {
    if (!currentMovie) {
        alert("Select a movie before writing a review.");
        return;
    }

    const title = document.getElementById("reviewTitle").value.trim();
    const content = document.getElementById("reviewText").value.trim();
    const spoiler = document.getElementById("spoilerToggle").checked;

    if (!title || !content) {
        alert("Please complete your review title and content.");
        return;
    }

    const reviews = getStorage("cineziReviews");

    reviews.unshift({
        id: Date.now(),
        movieId: currentMovie.id,
        movieTitle: currentMovie.title,
        title,
        content,
        spoiler,
        rating: selectedRating,
        helpful: 0,
        replies: [],
        date: new Date().toISOString()
    });

    saveStorage("cineziReviews", reviews);

    document.getElementById("reviewTitle").value = "";
    document.getElementById("reviewText").value = "";
    document.getElementById("spoilerToggle").checked = false;

    renderReviews();
});

function renderReviews() {
    const reviews = getStorage("cineziReviews");
    const list = document.getElementById("reviewList");

    document.getElementById("reviewCount").textContent =
        `${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`;

    if (!reviews.length) {
        list.innerHTML = `
            <div class="empty-state">
                No reviews yet. Be the first to share your thoughts.
            </div>
        `;
        return;
    }

    list.innerHTML = reviews.map(review => `
        <article class="review-card">
            <div class="review-user">
                <div class="review-avatar">U</div>
                <div class="review-user-info">
                    <strong>You</strong>
                    <span>${formatDate(review.date)}</span>
                </div>
                ${review.rating ? `
                    <span class="review-rating">★ ${review.rating}/5</span>
                ` : ""}
            </div>

            <h3>${escapeHTML(review.title)}</h3>
            <div class="review-movie">Review for ${escapeHTML(review.movieTitle || "a movie")}</div>

            ${review.spoiler ? `
                <span class="spoiler-warning">⚠ CONTAINS SPOILERS</span>
            ` : ""}

            <p class="spoiler-content ${review.spoiler ? "hidden" : ""}"
                id="review-content-${review.id}">
                ${escapeHTML(review.content)}
            </p>

            ${review.spoiler ? `
                <button class="text-action"
                    data-action="spoiler"
                    data-id="${review.id}">
                    Reveal spoiler
                </button>
            ` : ""}

            <div class="review-actions">
                <button class="text-action"
                    data-action="helpful"
                    data-id="${review.id}">
                    ♡ Helpful (${review.helpful || 0})
                </button>

                <button class="text-action"
                    data-action="reply"
                    data-id="${review.id}">
                    ↳ Reply
                </button>
            </div>

            <div class="reply-area">
                ${(review.replies || []).map(reply => `
                    <div class="reply-item">
                        <strong>${escapeHTML(reply.name)}:</strong>
                        ${escapeHTML(reply.text)}
                    </div>
                `).join("")}

                <input
                    type="text"
                    placeholder="Write a reply and press Enter..."
                    data-reply-id="${review.id}"
                >
            </div>
        </article>
    `).join("");
}

document.getElementById("reviewList").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;
    const reviews = getStorage("cineziReviews");
    const review = reviews.find(item => item.id === id);

    if (!review) return;

    if (action === "spoiler") {
        document.getElementById(`review-content-${id}`)
            .classList.remove("hidden");
        button.remove();
    }

    if (action === "helpful") {
        review.helpful = (review.helpful || 0) + 1;
        saveStorage("cineziReviews", reviews);
        renderReviews();
    }

    if (action === "reply") {
        document.querySelector(`[data-reply-id="${id}"]`)?.focus();
    }
});

document.getElementById("reviewList").addEventListener("keydown", event => {
    if (!event.target.matches("[data-reply-id]")) return;
    if (event.key !== "Enter") return;

    const id = Number(event.target.dataset.replyId);
    const text = event.target.value.trim();

    if (!text) return;

    const reviews = getStorage("cineziReviews");
    const review = reviews.find(item => item.id === id);

    if (!review) return;

    review.replies = review.replies || [];
    review.replies.push({ name: "You", text });

    saveStorage("cineziReviews", reviews);
    renderReviews();
});


// ========================================
// COMMUNITY / TASTE MATCH
// ========================================

function getUserGenres() {
    const ratings = getRatings();
    const genres = new Set();

    ratings.forEach(rating => {
        const movie = currentMovies.find(
            item => Number(item.id) === Number(rating.movieId)
        );

        (movie?.genre_ids || []).forEach(id => {
            if (genreNames[id]) genres.add(genreNames[id]);
        });
    });

    return genres;
}

function calculateTasteMatch(member) {
    const userGenres = getUserGenres();

    if (!userGenres.size) return null;

    const memberGenres = new Set(member.genres);
    const intersection = [...userGenres].filter(
        genre => memberGenres.has(genre)
    ).length;

    const union = new Set([...userGenres, ...memberGenres]).size;

    return Math.round((intersection / union) * 100);
}

function renderCommunity() {
    const grid = document.getElementById("communityGrid");

    grid.innerHTML = communityMembers.map(member => {
        const match = calculateTasteMatch(member);

        return `
            <article class="community-card">
                <div class="member-top">
                    <div class="member-avatar">${member.name.charAt(0)}</div>
                    <div>
                        <h3>${escapeHTML(member.name)}</h3>
                        <p>Movie enthusiast · Demo profile</p>
                    </div>
                </div>

                <div class="member-match">
                    <span>YOUR TASTE MATCH</span>
                    <strong class="match-score">${match === null ? "—" : `${match}%`}</strong>
                </div>

                <p>${escapeHTML(member.description)}</p>

                <div class="member-tags">
                    ${member.genres.map(genre =>
                        `<span>${escapeHTML(genre)}</span>`
                    ).join("")}
                </div>

                <button type="button" data-member="${escapeHTML(member.name)}">
                    Invite to Chat ↗
                </button>
            </article>
        `;
    }).join("");
}

document.getElementById("communityGrid").addEventListener("click", event => {
    const button = event.target.closest("[data-member]");
    if (!button) return;

    alert(
        `Chat invitation for ${button.dataset.member} is a demo feature.`
    );
});


// ========================================
// FORUM
// ========================================

document.getElementById("submitForum").addEventListener("click", () => {
    const title = document.getElementById("forumTitle").value.trim();
    const content = document.getElementById("forumText").value.trim();

    if (!title || !content) {
        alert("Please complete the discussion title and content.");
        return;
    }

    const posts = getStorage("cineziForum");

    posts.unshift({
        id: Date.now(),
        title,
        content,
        date: new Date().toISOString()
    });

    saveStorage("cineziForum", posts);

    document.getElementById("forumTitle").value = "";
    document.getElementById("forumText").value = "";

    renderForum();
});

function renderForum() {
    const posts = getStorage("cineziForum");
    const list = document.getElementById("forumList");

    if (!posts.length) {
        list.innerHTML = `
            <div class="empty-state">
                No discussions yet. Start the first conversation.
            </div>
        `;
        return;
    }

    list.innerHTML = posts.map(post => `
        <article class="forum-card">
            <div class="forum-card-top">
                <div class="forum-avatar">U</div>
                <div class="forum-author">
                    <strong>You</strong>
                    <span>Community member</span>
                </div>
                <span class="forum-date">${formatDate(post.date)}</span>
            </div>

            <h3>${escapeHTML(post.title)}</h3>
            <p>${escapeHTML(post.content)}</p>

            <div class="forum-card-bottom">
                <span class="forum-tag">Cinema discussion</span>
                <span class="forum-date">Open conversation</span>
            </div>
        </article>
    `).join("");
}


// ========================================
// NAVIGATION
// ========================================

const navLinks = document.getElementById("navLinks");

document.getElementById("menuToggle").addEventListener("click", () => {
    navLinks.classList.toggle("open");
});

document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("open");

        document.querySelectorAll(".nav-links a").forEach(item => {
            item.classList.remove("active");
        });

        link.classList.add("active");
    });
});


// ========================================
// PROFILE BUTTON
// ========================================

document.getElementById("profileBtn").addEventListener("click", () => {
    alert("Profile and account system is not connected yet.");
});


// ========================================
// INITIALIZE
// ========================================

async function initializeCinezi() {
    renderReviews();
    renderForum();
    renderWatchlist();
    renderCommunity();

    await loadGenres();
    await loadMovies();
}

initializeCinezi();