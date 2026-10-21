
(() => {
    "use strict";

    const app = document.querySelector("#app");
    const toast = document.querySelector("#toast");

    const API = "api/";

    const departments = [
        "Administration",
        "IT",
        "Dispatch",
        "Accounting",
        "HR",
        "Marketing",
        "Sales",
        "Customer Service"
    ];

    let toastTimer;
    let currentUser = null;
    let currentPortalTab = "overview";

    // Prevent user input from being treated as HTML.
    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    function userHasRole(user, role) {
        return String(user.role_names || "").split(",").map(value => value.trim()).includes(role);
    }

    function formatMoney(amount, currency = "PHP") {
        const value = Number(amount);
        if (!Number.isFinite(value)) {
            return "—";
        }

        return `${currency} ${value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    function productPriceLabel(product) {
        if (product.availability === "unavailable") {
            return "Currently unavailable";
        }
        if (product.availability === "quote_required") {
            return "Request a quote";
        }
        return product.price !== null
            ? formatMoney(product.price)
            : "Contact us for pricing";
    }

    function brand() {
        return `
            <a class="brand" href="#" data-action="home">
                <span class="brand-mark">☀</span>

                <span>
                    SUN SON <b>SOLAR</b>
                    <small>POWERING WHAT’S NEXT</small>
                </span>
            </a>
        `;
    }

    function showMessage(message, isError = false) {
        toast.textContent = message;
        toast.className = "toast show";

        if (isError) {
            toast.classList.add("error");
        }

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.className = "toast";
        }, 4500);
    }

    // Send requests to the PHP backend.
    async function api(path, options = {}) {
        const response = await fetch(API + path, {
            credentials: "same-origin",
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error(
                "Unexpected server response. Check that Apache and PHP are running."
            );
        }

        if (!response.ok || !result.ok) {
            throw new Error(result.message || "Request failed.");
        }

        return result;
    }

    // Shared header and footer.
    function shell(content, isHome = false) {
        app.innerHTML = `
            <header class="header${isHome ? " home-header" : ""}">
                <div class="header-inner">
                    ${brand()}

                    <nav>
                        ${isHome ? `
                            <a href="#home">Home</a>
                            <a href="#services">Services</a>
                            <a href="#about">About</a>
                        ` : `
                            <a href="#services">Services</a>
                            <a href="#about">About</a>
                        `}
                    </nav>

                    <div class="head-actions">
                        <button class="btn outline" data-action="login">
                            Log in
                        </button>

                        <button class="btn primary" data-action="register">
                            ${isHome ? "Get a quote ↗" : "Get started ↗"}
                        </button>
                    </div>
                </div>
            </header>

            ${content}

            <footer class="footer${isHome ? " home-footer" : ""}">
                <div>
                    ${brand()}
                    <p>
                        We don’t just capture sunlight.<br>
                        We help shape what comes next.
                    </p>
                </div>

                <div>
                    <b>Explore</b>
                    <a href="${isHome ? "#solutions" : "#services"}">${isHome ? "Solar solutions" : "Our services"}</a>
                    <a href="#about">Our story</a>
                </div>

                <div>
                    <b>Get in touch</b>
                    <p>
                        Pasig City, Philippines<br>
                        hello@sunsonsolar.com
                    </p>
                </div>

                <div>
                    <b>Account</b>
                    <a href="#" data-action="login" data-login-type="customer">Customer login</a>
                    <a href="#" data-action="login" data-login-type="employee">Employee login</a>
                    <a href="#" data-action="register">Create account</a>
                </div>
            </footer>

            <div class="footer-bottom">
                © 2026 Sun Son Solar. All rights reserved.
            </div>
        `;
    }

    function portalShell(user, active, content, navigation, roleLabel) {
        app.innerHTML = `
            <div class="portal-layout">
                <aside class="portal-sidebar">
                    ${brand()}
                    <p class="sidebar-role">${escapeHTML(roleLabel)}</p>

                    <nav class="portal-nav" aria-label="Workspace">
                        ${navigation.map(([key, label, icon]) => `
                            <button
                                class="${active === key ? "active" : ""}"
                                data-action="portal-tab"
                                data-tab="${escapeHTML(key)}"
                            >
                                <span>${escapeHTML(icon)}</span>
                                ${escapeHTML(label)}
                            </button>
                        `).join("")}
                    </nav>

                    <div class="sidebar-foot">
                        <strong>Brighter days ahead.</strong>
                        <span>Solar support, made simple.<br>Pasig City, Philippines</span>
                        <button data-action="logout">Sign out</button>
                    </div>
                </aside>

                <div class="portal-main">
                    <header class="portal-topbar">
                        <div class="breadcrumbs">
                            <span>Workspace</span>
                            <b>/</b>
                            <strong>${escapeHTML(roleLabel)}</strong>
                        </div>

                        <div class="user-pill">
                            <span class="demo-tag">LIVE WORKSPACE</span>
                            <span class="avatar">${escapeHTML(
                                user.full_name.slice(0, 1).toUpperCase()
                            )}</span>
                            <span>
                                <b>${escapeHTML(user.full_name)}</b>
                                <small>${escapeHTML(user.department || roleLabel)}</small>
                            </span>
                        </div>
                    </header>

                    <main class="portal-content">${content}</main>

                    <footer class="portal-footer">
                        Sun Son Solar · Powered by clean energy · 2026
                        <span>Privacy&nbsp;&nbsp; | &nbsp;&nbsp;Terms</span>
                    </footer>
                </div>
            </div>
        `;
    }

    // Public homepage.
    function home() {
        shell(`
            <main class="home-page" id="home">
                <section class="home-hero">
                    <div class="home-hero-copy">
                        <span class="home-eyebrow">
                            SUN SON SOLAR <i></i> CLEAN ENERGY, MADE PERSONAL
                        </span>
                        <h1>Power your future with <em>solar.</em></h1>
                        <p>
                            Thoughtful solar solutions for a brighter home,
                            a stronger business, and a more sustainable tomorrow.
                        </p>
                        <div class="home-actions">
                            <a class="home-button home-button-dark" href="#solutions">
                                Explore solar solutions <span aria-hidden="true">↗</span>
                            </a>
                            <button class="home-text-button" data-action="register">
                                Talk to our team <span aria-hidden="true">→</span>
                            </button>
                        </div>
                        <div class="home-proof">
                            <span class="proof-sun" aria-hidden="true">☼</span>
                            <p><strong>Rooted in Pasig City</strong><br>Here to help you make the switch with confidence.</p>
                        </div>
                    </div>

                    <div class="home-hero-visual">
                        <img
                            src="https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1400&q=85"
                            alt="Solar panels catching sunlight on a clear day"
                        >
                        <span class="hero-image-wash" aria-hidden="true"></span>
                        <div class="hero-note">
                            <span class="hero-note-icon" aria-hidden="true">☀</span>
                            <span><small>MAKE ROOM FOR</small><strong>A brighter kind of power.</strong></span>
                        </div>
                        <span class="hero-image-caption">A better tomorrow begins right at home.</span>
                    </div>
                    <span class="hero-side-note">SUNLIGHT, WITH PURPOSE <i></i> 14° 34′ N</span>
                </section>

                <section class="home-intro" aria-label="Our approach">
                    <span>GOOD ENERGY, FROM THE VERY FIRST CONVERSATION.</span>
                    <p>We make going solar feel <em>clear, considered, and close to home.</em></p>
                </section>

                <section class="home-solutions" id="solutions">
                    <div class="home-section-heading">
                        <div>
                            <span class="home-eyebrow">MADE FOR YOUR NEXT CHAPTER</span>
                            <h2>Find your way to solar.</h2>
                        </div>
                        <a href="#contact">Not sure where to start? <b>Let’s talk ↗</b></a>
                    </div>

                    <div class="public-product-grid" id="publicProducts" aria-live="polite">
                        <p class="muted">Loading solar products...</p>
                    </div>
                    <p class="home-disclaimer">Product specifications, availability and pricing depend on your system design. Contact our team for a tailored quotation.</p>
                </section>

                <section class="home-services" id="services">
                    <div class="home-section-heading">
                        <div>
                            <span class="home-eyebrow">HERE FOR EVERY STEP</span>
                            <h2>Good energy, with good support.</h2>
                        </div>
                    </div>
                    <div class="public-service-grid" id="publicServices" aria-live="polite">
                        <p class="muted">Loading solar services...</p>
                    </div>
                </section>

                <section class="home-story" id="about">
                    <div class="story-inner">
                        <div class="story-mark">
                            <span class="story-sun" aria-hidden="true"><i></i></span>
                            <strong>Sinag ng Hiraya</strong>
                            <small>Where Every Ray Holds a Promise.</small>
                        </div>
                        <div class="story-copy">
                            <span class="home-eyebrow">A LITTLE SUNSHINE, A LOT OF HEART</span>
                            <h2>Rooted in family.<br>Reaching for a brighter future.</h2>
                            <p>
                                Sun Son Solar was founded by Katherine Sinagaraw “Kat” and her father,
                                Santino Sinagaraw “Sonny,” with a simple belief: clean energy should
                                feel closer, more human, and within reach.
                            </p>
                            <p>
                                From our home in Pasig City, we bring people and solar
                                solutions together—with thoughtful guidance at every step.
                            </p>
                            <blockquote>“Sinag ng Hiraya” speaks to hope, possibility, and a brighter future—one promise we make, every ray.</blockquote>
                        </div>
                        <div class="story-values">
                            <article><span>✳</span><h3>Progress and sustainability</h3><p>Embracing progress and encouraging clean energy as part of a more sustainable future.</p></article>
                            <article><span>⌂</span><h3>Access for everyone</h3><p>Making solar feel less complicated, more welcoming, and within reach.</p></article>
                            <article><span>✧</span><h3>Quality and reliability</h3><p>Thoughtful solutions and dependable support, from first hello to what comes next.</p></article>
                        </div>
                        <a class="story-cta" href="#contact">OUR COMMITMENT <span>Good energy starts with people. <b>Get to know us ↗</b></span></a>
                    </div>
                </section>

                <section class="home-steps">
                    <div class="home-section-heading">
                        <div>
                            <span class="home-eyebrow">A BRIGHTER WAY FORWARD</span>
                            <h2>Solar, without the guesswork.</h2>
                        </div>
                        <p>We’ll help you understand your options and feel good about every next step.</p>
                    </div>
                    <div class="steps-grid">
                        <article><span>01</span><h3>Tell us what you need</h3><p>Share a little about your home, your goals, and what you’d like solar to do for you.</p></article>
                        <article><span>02</span><h3>Explore what fits</h3><p>Our team will help you discover an approach that makes sense for your space.</p></article>
                        <article><span>03</span><h3>Let’s build a brighter future</h3><p>Get clear guidance and support as you take your next step toward solar.</p></article>
                    </div>
                </section>

                <section class="home-testimonials">
                    <div class="home-section-heading">
                        <div><span class="home-eyebrow">SHARED WITH PERMISSION</span><h2>Stories from the solar journey.</h2></div>
                    </div>
                    <div class="testimonial-grid" id="publicTestimonials" aria-live="polite">
                        <p class="muted">Loading customer stories...</p>
                    </div>
                </section>

                <section class="home-faq">
                    <div>
                        <span class="home-eyebrow">A FEW THINGS YOU MAY BE WONDERING</span>
                        <h2>Good questions are always welcome.</h2>
                    </div>
                    <details><summary>How do I find out what solar setup is right for me?</summary><p>Start with a consultation request. Our team can learn about your goals and guide you toward an appropriate system design and quotation.</p></details>
                    <details><summary>Can I book maintenance or repairs?</summary><p>Yes. Create a customer account to request consultation, installation, maintenance, repair, monitoring, and other available services.</p></details>
                    <details><summary>Where is Sun Son Solar based?</summary><p>We’re based in Pasig City and support customers across the surrounding area. Contact our team to check service availability at your address.</p></details>
                </section>

                <section class="home-contact" id="contact">
                    <div class="contact-orbit" aria-hidden="true"><i></i><b></b></div>
                    <div>
                        <span class="home-eyebrow">YOUR SOLAR STORY STARTS HERE</span>
                        <h2>Ready when you are.</h2>
                        <p>Let’s find a brighter way forward—together.</p>
                    </div>
                    <button class="home-button home-button-yellow" data-action="register">
                        Start a conversation <span aria-hidden="true">↗</span>
                    </button>
                </section>
            </main>
        `, true);
        loadHomepageCatalog();
    }

    async function loadHomepageCatalog() {
        try {
            const result = await api("public.php");
            const products = document.querySelector("#publicProducts");
            const services = document.querySelector("#publicServices");
            const testimonials = document.querySelector("#publicTestimonials");
            if (!products || !services || !testimonials) {
                return;
            }

            products.innerHTML = result.products.length
                ? result.products.map(product => `
                    <article class="public-product">
                        <div class="public-product-image">${product.image_url
                            ? `<img src="${escapeHTML(product.image_url)}" alt="">`
                            : `<span aria-hidden="true">${({
                                solar_panel: "▤",
                                inverter: "⌁",
                                battery: "▰",
                                mounting_equipment: "⌂",
                                wire: "⌁",
                                other: "☼"
                            })[product.category] || "☼"}</span>`}</div>
                        <div class="public-product-copy">
                            <span>${escapeHTML(product.category.replaceAll("_", " "))}</span>
                            <h3>${escapeHTML(product.name)}</h3>
                            <p>${escapeHTML(product.description)}</p>
                            <div>${escapeHTML(productPriceLabel(product))}</div>
                        </div>
                    </article>
                `).join("")
                : '<p class="muted">Product information is being updated. Contact us for recommendations.</p>';

            services.innerHTML = result.services.length
                ? result.services.map(service => `
                    <article class="public-service">
                        <span>☼</span>
                        <h3>${escapeHTML(service.name)}</h3>
                        <p>${escapeHTML(service.description)}</p>
                        <small>${service.price !== null ? `PHP ${Number(service.price).toLocaleString()}` : escapeHTML(service.price_label)}</small>
                    </article>
                `).join("")
                : '<p class="muted">Contact us to explore available solar services.</p>';

            testimonials.innerHTML = result.testimonials.length
                ? result.testimonials.map(item => `
                    <article class="testimonial-card">
                        <span class="trust-stars" aria-label="${Number(item.rating)} out of 5 stars">${"★".repeat(Number(item.rating))}</span>
                        <blockquote>“${escapeHTML(item.quote)}”</blockquote>
                        <p>${escapeHTML(item.customer_name)}</p>
                    </article>
                `).join("")
                : '<p class="muted">Customer stories will appear here after they have been shared with permission.</p>';
        } catch (error) {
            for (const selector of ["#publicProducts", "#publicServices", "#publicTestimonials"]) {
                const target = document.querySelector(selector);
                if (target) {
                    target.textContent = error.message;
                }
            }
        }
    }

    // Login and registration share the same form layout.
    function auth(register = false, loginType = "customer") {
        shell(`
            <main class="auth-layout">
                <section class="auth-card">
                    <span class="eyebrow">
                        ${register
                            ? "CUSTOMER REGISTRATION"
                            : loginType === "employee"
                                ? "TEAM ACCESS · AUTHORIZED USE ONLY"
                                : "CUSTOMER LOGIN"}
                    </span>

                    <h1>
                        ${register
                            ? "Create your account."
                            : loginType === "employee"
                                ? "Welcome, team."
                                : "Good to see you again."}
                    </h1>

                    <p>
                        ${register
                            ? "Create your customer account. Keep your details in one place and start exploring solar with us."
                            : loginType === "employee"
                                ? "Log in with the credentials provided for your employee or associate account."
                                : "Sign in to continue to your customer workspace."}
                    </p>

                    <div class="tabs">
                        <button
                            class="${!register ? "active" : ""}"
                            data-action="login"
                        >
                            Log in
                        </button>

                        <button
                            class="${register ? "active" : ""}"
                            data-action="register"
                        >
                            Register
                        </button>
                    </div>

                    ${!register ? `
                        <div class="tabs auth-role-tabs" aria-label="Choose account type">
                            <button
                                class="${loginType === "customer" ? "active" : ""}"
                                data-action="login"
                                data-login-type="customer"
                                aria-pressed="${loginType === "customer"}"
                            >
                                Customer
                            </button>
                            <button
                                class="${loginType === "employee" ? "active" : ""}"
                                data-action="login"
                                data-login-type="employee"
                                aria-pressed="${loginType === "employee"}"
                            >
                                Employee / associate
                            </button>
                        </div>
                    ` : ""}

                    <form id="authForm" novalidate>
                        ${!register ? `<input type="hidden" name="login_type" value="${loginType}">` : ""}
                        ${register ? `
                            <div class="form-row">
                                <label>First name<input name="first_name" maxlength="80" required autocomplete="given-name"></label>
                                <label>Middle name<input name="middle_name" maxlength="80" autocomplete="additional-name"></label>
                                <label>Last name<input name="last_name" maxlength="80" required autocomplete="family-name"></label>
                            </div>
                        ` : ""}

                        <label>
                            Email address or username
                            <input
                                name="email"
                                required
                                autocomplete="${register ? "email" : "username"}"
                                placeholder="${register ? "" : "Email address or username"}"
                            >
                        </label>

                        ${register ? `
                            <div class="form-row">
                                <label>Username
                                    <input name="username" minlength="3" maxlength="60" pattern="[A-Za-z0-9._\\-]+" required autocomplete="username">
                                </label>
                                <label>
                                    Phone number
                                    <input
                                        name="phone"
                                        type="tel"
                                        inputmode="numeric"
                                        pattern="[0-9]{10,15}"
                                        maxlength="15"
                                        minlength="10"
                                        placeholder="Digits only"
                                        required
                                    >
                                </label>

                                <label>Birthdate
                                    <input name="birthdate" type="date" max="${new Date().toISOString().slice(0, 10)}" required autocomplete="bday">
                                </label>

                                <label>
                                    Gender
                                    <select name="gender" required>
                                        <option value="">Select</option>
                                        <option value="female">Female</option>
                                        <option value="male">Male</option>
                                        <option value="other">Other</option>
                                        <option value="prefer-not-to-say">
                                            Prefer not to say
                                        </option>
                                    </select>
                                </label>
                            </div>

                            <label>
                                Home or service address
                                <input name="address" maxlength="255" required autocomplete="street-address">
                            </label>

                            <p class="hint">Employee accounts are created by HR or an administrator. <button class="text-link" type="button" data-action="login" data-login-type="employee">Log in to team account</button></p>
                        ` : ""}

                        <label>
                            Password
                            <input
                                name="password"
                                type="password"
                                minlength="8"
                                required
                                autocomplete="${register
                                    ? "new-password"
                                    : "current-password"}"
                            >
                        </label>

                        ${register ? `
                            <label>
                                Confirm password
                                <input
                                    name="confirm_password"
                                    type="password"
                                    minlength="8"
                                    required
                                    autocomplete="new-password"
                                >
                            </label>
                        ` : ""}

                        <button class="btn primary submit" type="submit">
                            ${register ? "Create account" : "Sign in"} ↗
                        </button>

                        <p id="formMessage" class="message" role="status"></p>
                    </form>

                    <button class="text-link" data-action="home">
                        ← Back to website
                    </button>
                </section>

                <aside class="auth-aside">
                    <span class="eyebrow">POWERING WHAT’S NEXT</span>

                    <h2>
                        Good energy starts with a good connection.
                    </h2>

                    <p>
                        ${loginType === "employee"
                            ? "A dedicated space for the Sun Son Solar team. Purpose-led work. A shared brighter future."
                            : "Manage your solar journey with a workspace designed around you."}
                    </p>

                    <div class="aside-sun">☀</div>
                </aside>
            </main>
        `);

        const form = document.querySelector("#authForm");
        if (register) {
            const phoneInput = form.elements.phone;

            phoneInput.addEventListener("input", () => {
                phoneInput.value = phoneInput.value
                    .replace(/\D/g, "")
                    .slice(0, 15);
            });
        }

        form.addEventListener("submit", async event => {
            event.preventDefault();

            const message = document.querySelector("#formMessage");
            const button = form.querySelector('[type="submit"]');

            const formData = Object.fromEntries(
                new FormData(form).entries()
            );

            message.textContent = "";
            message.className = "message";

            if (!form.reportValidity()) {
                return;
            }

            if (
                register &&
                formData.password !== formData.confirm_password
            ) {
                message.textContent = "Passwords do not match.";
                return;
            }

            button.disabled = true;

            try {
                if (register) {
                    const result = await api(
                        "auth.php?action=register",
                        {
                            method: "POST",
                            body: JSON.stringify(formData)
                        }
                    );

                    message.className = "message success";
                    message.textContent = result.message;

                    form.reset();

                    // Registration does not automatically log in.
                    setTimeout(() => auth(false), 2200);
                } else {
                    const result = await api(
                        "auth.php?action=login",
                        {
                            method: "POST",
                            body: JSON.stringify(formData)
                        }
                    );

                    renderPortal(result.user);
                }
            } catch (error) {
                message.textContent = error.message;
            } finally {
                button.disabled = false;
            }
        });
    }

    function statCard(title, value, description = "") {
        return `
            <article class="stat-card">
                <span>${escapeHTML(title)}</span>
                <strong>${escapeHTML(value)}</strong>
                <small>${escapeHTML(description)}</small>
            </article>
        `;
    }

    // Send each user to the correct portal.
    function renderPortal(user, tab = "overview") {
        currentUser = user;
        currentPortalTab = tab;

        if (user.account_type === "admin") {
            adminPage(user, tab);
            return;
        }

        if (user.account_type === "employee") {
            employeePage(user, tab === "overview" ? "jobs" : tab);
            return;
        }

        customerPage(user, tab);
    }

    function customerPage(user, tab = "overview") {
        const navigation = [
            ["overview", "Overview", "01"],
            ["book", "Book a service", "02"],
            ["requests", "My requests", "03"],
            ["notifications", "Notifications", "04"],
            ["payments", "Payments & receipts", "05"],
            ["support", "Support", "06"],
            ["profile", "My profile", "07"]
        ];
        let content = "";

        if (tab === "book") {
            content = `
                <section class="page-heading">
                    <span class="eyebrow">CUSTOMER WORKSPACE</span>
                    <h1>Make your next move.</h1>
                    <p>Tell us what you need and our team will coordinate the next step.</p>
                </section>
                <section class="panel form-panel">
                    <h2>Request a solar service</h2>
                    <form id="requestForm">
                        <div class="form-row">
                            <label>Service
                                <select name="service_type" required>
                                    <option value="">Choose a service</option>
                                    <option>Consultation</option>
                                    <option>Designing</option>
                                    <option>Permitting</option>
                                    <option>Solar installation</option>
                                    <option>Maintenance</option>
                                    <option>Repair</option>
                                    <option>System inspection</option>
                                    <option>Monitoring</option>
                                </select>
                            </label>
                            <label>Preferred date
                                <input name="preferred_date" type="date"
                                    min="${new Date().toISOString().slice(0, 10)}">
                            </label>
                            <label>Preferred time
                                <input name="preferred_time" type="time">
                            </label>
                        </div>
                        <label>Service address
                            <input name="address" maxlength="255" required
                                autocomplete="street-address">
                        </label>
                        <label>Project details
                            <textarea name="details" rows="4" maxlength="4000"
                                required placeholder="Tell us about your property and energy goals."></textarea>
                        </label>
                        <button class="btn primary" type="submit">Submit service request ↗</button>
                        <p id="requestMessage" class="message" role="status"></p>
                    </form>
                </section>
            `;
        } else if (tab === "requests") {
            content = `
                <section class="page-heading">
                    <span class="eyebrow">YOUR SOLAR WORKSPACE</span>
                    <h1>My service requests</h1>
                    <p>Track approvals, appointments and service progress.</p>
                </section>
                <section class="panel"><div id="myRequests">Loading requests...</div></section>
            `;
        } else if (tab === "notifications") {
            content = `
                <section class="page-heading">
                    <span class="eyebrow">UPDATES</span>
                    <h1>Notifications</h1>
                    <p>Service reminders and updates from the Sun Son Solar team.</p>
                </section>
                <section class="panel"><div id="notifications">Loading notifications...</div></section>
            `;
        } else if (tab === "payments") {
            content = `
                <section class="page-heading"><span class="eyebrow">ACCOUNT HISTORY</span><h1>Payments & receipts</h1><p>Review payment records that have been recorded for your service bookings.</p></section>
                <section class="panel"><div id="paymentList">Loading payment records...</div></section>
                <p class="muted">Payments are recorded manually by the Accounting team. Online payment processing is not configured.</p>
            `;
        } else if (tab === "support") {
            content = `
                <section class="page-heading"><span class="eyebrow">WE’RE HERE TO HELP</span><h1>Customer support</h1><p>Send a question or concern to the Sun Son Solar team.</p></section>
                <section class="panel form-panel">
                    <form id="supportForm">
                        <label>Subject<input name="subject" maxlength="160" required></label>
                        <label>Booking ID (optional)<input name="booking_id" type="number" min="1"></label>
                        <label>How can we help?<textarea name="message" rows="4" maxlength="4000" required></textarea></label>
                        <button class="btn primary" type="submit">Submit support request</button>
                        <p id="supportMessage" class="message" role="status"></p>
                    </form>
                </section>
                <section class="panel"><h2>My support requests</h2><div id="ticketList">Loading tickets...</div></section>
            `;
        } else if (tab === "profile") {
            content = `
                <section class="page-heading">
                    <span class="eyebrow">ACCOUNT</span>
                    <h1>Your profile</h1>
                    <p>Keep your contact and service address details up to date.</p>
                </section>
                ${profileDetailsForm(user)}
                ${profilePasswordForm()}
            `;
        } else {
            content = `
                <section class="welcome-card">
                    <div>
                        <span class="eyebrow">SUN SON SOLAR / YOUR SOLAR WORKSPACE</span>
                        <h1>Bright days ahead, ${escapeHTML(user.full_name.split(" ")[0])}.</h1>
                        <p>Track your solar project, manage service visits and stay connected with your team.</p>
                        <button class="btn primary" data-action="portal-tab" data-tab="book">Book a service ↗</button>
                    </div>
                    <div class="welcome-sun" aria-hidden="true">☀</div>
                </section>
                <div class="stats">
                    ${statCard("Account", user.status, "Customer profile")}
                    ${statCard("Service team", "Connected", "Sun Son Solar")}
                    ${statCard("Support", "Available", "We’re here to help")}
                </div>
                <section class="panel">
                    <div class="panel-title">
                        <div><span class="eyebrow">RECENT ACTIVITY</span><h2>My service requests</h2></div>
                        <button class="btn outline small" data-action="portal-tab" data-tab="requests">View all</button>
                    </div>
                    <div id="myRequests">Loading requests...</div>
                </section>
            `;
        }

        portalShell(user, tab, content, navigation, "Customer portal");
        if (tab === "overview" || tab === "requests") {
            loadRequests();
        }
        if (tab === "notifications") {
            loadNotifications();
        }
        if (tab === "payments") {
            loadPayments();
        }
        if (tab === "support") {
            loadTickets();
            bindSupportForm();
        }
        if (tab === "profile") {
            bindProfileForm();
            bindProfilePasswordForm();
        }

        const serviceSelect = document.querySelector(
            '#requestForm [name="service_type"]'
        );
        if (serviceSelect) {
            api("portal.php?action=catalog")
                .then(result => {
                    const selectedService = serviceSelect.value;
                    serviceSelect.innerHTML = `
                        <option value="">Choose a service</option>
                        ${result.services.map(service => `
                            <option value="${escapeHTML(service.service_type)}">
                                ${escapeHTML(service.service_type)}
                            </option>
                        `).join("")}
                    `;
                    if (result.services.some(service => service.service_type === selectedService)) {
                        serviceSelect.value = selectedService;
                    }
                })
                .catch(error => showMessage(error.message, true));
        }

        const requestForm = document.querySelector("#requestForm");
        if (requestForm) {
            requestForm.addEventListener("submit", async event => {
                event.preventDefault();
                const form = event.currentTarget;
                const message = document.querySelector("#requestMessage");

                try {
                    const result = await api("request.php?action=create", {
                        method: "POST",
                        body: JSON.stringify(Object.fromEntries(new FormData(form)))
                    });
                    message.className = "message success";
                    message.textContent = result.message;
                    form.reset();
                    setTimeout(() => customerPage(user, "requests"), 1200);
                } catch (error) {
                    message.textContent = error.message;
                }
            });
        }
    }

    function employeePage(user, tab = "jobs") {
        const isTechnician = userHasRole(user, "technician");
        const canViewJobs = isTechnician || userHasRole(user, "dispatcher");
        const navigation = user.department === "HR"
            ? [
                ["employees", "Employee accounts", "01"],
                ["notifications", "Announcements", "02"],
                ["profile", "My profile", "03"]
            ]
            : user.department === "Accounting"
                ? [
                    ["payments", "Payments & receipts", "01"],
                    ["notifications", "Messages & notices", "02"],
                    ["profile", "My profile", "03"]
                ]
                : user.department === "Customer Service"
                    ? [
                        ["support", "Customer concerns", "01"],
                        ["notifications", "Messages & notices", "02"],
                        ["profile", "My profile", "03"]
                    ]
                    : isTechnician
                        ? [
                            ["jobs", "My jobs & check-in", "01"],
                            ["reports", "Job details & reports", "02"],
                            ["notifications", "Messages & notices", "03"],
                            ["profile", "My profile", "04"]
                        ]
                        : [
                            ...(canViewJobs ? [["jobs", "Service dispatch", "01"]] : []),
                            ...(canViewJobs ? [["support", "Customer concerns", "02"]] : []),
                            ["notifications", "Messages & notices", "03"],
                            ["profile", "My profile", "04"]
                        ];
        const content = tab === "notifications"
            ? `
                <section class="page-heading">
                    <span class="eyebrow">TEAM WORKSPACE</span>
                    <h1>${user.department === "HR" ? "Share a team announcement." : "Stay connected."}</h1>
                    <p>Read company updates and important team notices.</p>
                </section>
                ${user.department === "HR" ? `
                    <section class="panel form-panel">
                        <h2>Post an employee announcement</h2>
                        <form id="announcementForm">
                            <label>Audience<select name="audience"><option value="employees">All employees</option><option value="technicians">Technicians</option><option value="all">All portal users</option></select></label>
                            <label>Title<input name="title" maxlength="160" required></label>
                            <label>Announcement<textarea name="message" rows="4" maxlength="4000" required></textarea></label>
                            <button class="btn primary" type="submit">Publish announcement</button>
                            <p id="announcementMessage" class="message" role="status"></p>
                        </form>
                    </section>
                ` : ""}
                <section class="panel"><div id="notifications">Loading notifications...</div></section>
            `
            : tab === "profile"
                ? `
                    <section class="page-heading">
                        <span class="eyebrow">ACCOUNT</span><h1>Your profile</h1>
                    </section>
                    ${profileDetailsForm(user)}
                    ${profilePasswordForm()}
                `
                : tab === "employees" && user.department === "HR"
                    ? `
                        <section class="page-heading"><span class="eyebrow">HUMAN RESOURCES</span><h1>Employee accounts</h1><p>Create and manage employee profiles and department access.</p></section>
                        ${employeeCreateForm()}
                        <section class="panel"><h2>Employee directory</h2><div id="employeeList">Loading employees...</div></section>
                        ${userEditForm()}
                    `
                    : tab === "payments" && user.department === "Accounting"
                        ? `
                            <section class="page-heading"><span class="eyebrow">ACCOUNTING</span><h1>Payment records & receipts</h1><p>Record offline payments against customer bookings. This does not process or charge online payments.</p></section>
                            ${paymentRecordForm()}
                            <section class="panel"><h2>Recorded payments</h2><div id="paymentList">Loading payment records...</div></section>
                        `
                        : tab === "support" && (user.department === "Customer Service" || user.department === "Dispatch")
                            ? `
                                <section class="page-heading"><span class="eyebrow">CUSTOMER SERVICE</span><h1>Customer concerns</h1><p>Review incoming support requests and update their status.</p></section>
                                <section class="panel"><div id="ticketList">Loading support requests...</div></section>
                            `
                : !canViewJobs
                    ? `
                    <section class="page-heading">
                        <span class="eyebrow">EMPLOYEE WORKSPACE</span>
                        <h1>Hello, ${escapeHTML(user.full_name)}.</h1>
                        <p>Your ${escapeHTML(user.department)} workspace is ready. Field jobs are available to approved Technician and Dispatch accounts.</p>
                    </section>
                    <section class="panel"><span class="status">${escapeHTML(user.status)}</span><p class="muted">Contact an administrator if you need access to field assignments.</p></section>
                `
                    : `
                    <section class="page-heading">
                        <span class="eyebrow">SUN SON SOLAR / FIELD WORKSPACE</span>
                        <h1>${tab === "reports" ? "Job detail & issue report" : "Ready for the day?"}</h1>
                        <p>Review assigned jobs, check in on site and keep dispatch informed.</p>
                    </section>
                    ${tab === "reports" ? `
                        <section class="panel">
                            <h2>Job detail & report</h2>
                            <p class="muted">Open a job below to submit an issue report or update its status.</p>
                            <div id="myRequests">Loading jobs...</div>
                        </section>
                    ` : `
                        <section class="panel">
                            <div class="panel-title">
                                <div><span class="eyebrow">ASSIGNED WORK</span><h2>Your service jobs</h2></div>
                                <span class="status status-scheduled">Field workspace</span>
                            </div>
                            <div id="myRequests">Loading jobs...</div>
                        </section>
                    `}
                `;

        portalShell(user, tab, content, navigation, isTechnician ? "Technician portal" : `${user.department} portal`);
        if (canViewJobs && ["jobs", "reports"].includes(tab)) {
            loadRequests();
        } else if (tab === "notifications") {
            loadNotifications();
            bindAnnouncementForm();
        } else if (tab === "employees" && user.department === "HR") {
            loadEmployeeDirectory();
            bindEmployeeForm();
            bindUserEditForm();
        } else if (tab === "payments" && user.department === "Accounting") {
            loadPayments();
            bindPaymentForm();
        } else if (tab === "support" && ["Customer Service", "Dispatch"].includes(user.department)) {
            loadTickets(true);
        }
        if (tab === "profile") {
            bindProfileForm();
            bindProfilePasswordForm();
        }
    }

    function profilePasswordForm() {
        return `
            <section class="panel">
                <h2>Change password</h2>
                <form id="profilePasswordForm" class="password-form">
                    <label>Current password
                        <input type="password" name="current_password" required autocomplete="current-password">
                    </label>
                    <label>New password (10+ characters)
                        <input type="password" name="new_password" minlength="10" required autocomplete="new-password">
                    </label>
                    <button class="btn primary">Update password</button>
                    <p id="profilePasswordMessage" class="message" role="status"></p>
                </form>
            </section>
        `;
    }

    function profileDetailsForm(user) {
        return `
            <section class="panel form-panel">
                <h2>Personal details</h2>
                <form id="profileDetailsForm">
                    <div class="form-row">
                        <label>First name<input name="first_name" maxlength="80" value="${escapeHTML(user.first_name || "")}" required></label>
                        <label>Middle name<input name="middle_name" maxlength="80" value="${escapeHTML(user.middle_name || "")}"></label>
                        <label>Last name<input name="last_name" maxlength="80" value="${escapeHTML(user.last_name || "")}" required></label>
                    </div>
                    <div class="form-row">
                        <label>Username<input name="username" minlength="3" maxlength="60" pattern="[A-Za-z0-9._\\-]+" value="${escapeHTML(user.username || "")}" required></label>
                        <label>Email address<input name="email" type="email" maxlength="190" value="${escapeHTML(user.email || "")}" required></label>
                    </div>
                    <div class="form-row">
                        <label>Phone number<input name="phone" type="tel" pattern="[0-9]{10,15}" maxlength="15" value="${escapeHTML(user.phone || "")}" required></label>
                        <label>Birthdate<input name="birthdate" type="date" max="${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}" value="${escapeHTML(user.birthdate || "")}" required></label>
                        <label>Gender
                            <select name="gender" required>
                                ${[
                                    ["female", "Female"],
                                    ["male", "Male"],
                                    ["other", "Other"],
                                    ["prefer-not-to-say", "Prefer not to say"]
                                ].map(([value, label]) => `<option value="${value}" ${user.gender === value ? "selected" : ""}>${label}</option>`).join("")}
                            </select>
                        </label>
                    </div>
                    <label>Address<input name="address" maxlength="255" value="${escapeHTML(user.address || "")}" required></label>
                    <button class="btn primary" type="submit">Save profile</button>
                    <p id="profileDetailsMessage" class="message" role="status"></p>
                </form>
            </section>
        `;
    }

    function employeeCreateForm() {
        return `
            <section class="panel form-panel add-employee">
                <h2>Create employee account</h2>
                <p class="muted">Only HR and administrators can create employee accounts. Share temporary passwords securely.</p>
                <form id="employeeForm">
                    <div class="form-row">
                        <label>First name<input name="first_name" maxlength="80" required></label>
                        <label>Middle name<input name="middle_name" maxlength="80"></label>
                        <label>Last name<input name="last_name" maxlength="80" required></label>
                    </div>
                    <div class="form-row">
                        <label>Username<input name="username" minlength="3" maxlength="60" pattern="[A-Za-z0-9._\\-]+" required></label>
                        <label>Email address<input name="email" type="email" maxlength="190" required></label>
                    </div>
                    <div class="form-row">
                        <label>Phone number<input name="phone" type="tel" pattern="[0-9]{10,15}" maxlength="15" required></label>
                        <label>Birthdate<input name="birthdate" type="date" max="${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}" required></label>
                        <label>Gender
                            <select name="gender" required>
                                <option value="prefer-not-to-say">Prefer not to say</option>
                                <option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                            </select>
                        </label>
                    </div>
                    <label>Address<input name="address" maxlength="255" required></label>
                    <div class="form-row">
                        <label>Department<select name="department" required><option value="">Select department</option>${departments.map(department => `<option value="${escapeHTML(department)}">${escapeHTML(department)}</option>`).join("")}</select></label>
                        <label>Role<select name="role" required>
                            <option value="employee">Employee</option>
                            <option value="dispatcher">Dispatcher</option>
                            <option value="technician">Technician</option>
                            <option value="accounting">Accounting</option>
                            <option value="hr">HR</option>
                            <option value="customer_service">Customer Service</option>
                        </select></label>
                        <label>Temporary password (12+ characters)<input name="temporary_password" type="password" minlength="12" required autocomplete="new-password"></label>
                    </div>
                    <button class="btn primary" type="submit">Create employee account</button>
                    <p id="employeeMessage" class="message" role="status"></p>
                </form>
            </section>
        `;
    }

    function userEditForm() {
        return `
            <section class="panel form-panel" id="userEditPanel" hidden>
                <h2>Edit account</h2>
                <form id="userEditForm">
                    <input name="id" type="hidden">
                    <div class="form-row">
                        <label>First name<input name="first_name" maxlength="80" required></label>
                        <label>Middle name<input name="middle_name" maxlength="80"></label>
                        <label>Last name<input name="last_name" maxlength="80" required></label>
                    </div>
                    <div class="form-row">
                        <label>Username<input name="username" minlength="3" maxlength="60" pattern="[A-Za-z0-9._\\-]+" required></label>
                        <label>Email<input name="email" type="email" maxlength="190" required></label>
                        <label>Phone<input name="phone" pattern="[0-9]{10,15}" maxlength="15" required></label>
                    </div>
                    <div class="form-row">
                        <label>Birthdate<input name="birthdate" type="date" max="${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}" required></label>
                        <label>Gender<select name="gender" required><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer-not-to-say">Prefer not to say</option></select></label>
                        <label data-edit-department hidden>Department<select name="department">${departments.map(department => `<option value="${escapeHTML(department)}">${escapeHTML(department)}</option>`).join("")}</select></label>
                        <label data-edit-role hidden>Role<select name="role">
                            <option value="employee">Employee</option>
                            <option value="dispatcher">Dispatcher</option>
                            <option value="technician">Technician</option>
                            <option value="accounting">Accounting</option>
                            <option value="hr">HR</option>
                            <option value="customer_service">Customer Service</option>
                        </select></label>
                    </div>
                    <label>Address<input name="address" maxlength="255" required></label>
                    <button class="btn primary" type="submit">Save account changes</button>
                    <button class="btn outline" type="button" data-close-user-edit>Cancel</button>
                    <p id="userEditMessage" class="message" role="status"></p>
                </form>
            </section>
        `;
    }

    async function loadEmployeeDirectory() {
        const container = document.querySelector("#employeeList");
        if (!container) {
            return;
        }
        try {
            const result = await api("admin.php?action=users");
            container.innerHTML = employeeMarkup(result.users);
        } catch (error) {
            container.textContent = error.message;
        }
    }

    function bindEmployeeForm() {
        const form = document.querySelector("#employeeForm");
        if (!form) {
            return;
        }
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const message = document.querySelector("#employeeMessage");
            try {
                const result = await api("admin.php?action=create-employee", {
                    method: "POST",
                    body: JSON.stringify(Object.fromEntries(new FormData(form)))
                });
                message.className = "message success";
                message.textContent = result.message;
                form.reset();
                await loadEmployeeDirectory();
            } catch (error) {
                message.textContent = error.message;
            }
        });
    }

    function bindUserEditForm() {
        const form = document.querySelector("#userEditForm");
        if (!form) {
            return;
        }
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const message = document.querySelector("#userEditMessage");
            try {
                const result = await api("admin.php?action=update-user", {
                    method: "POST",
                    body: JSON.stringify(Object.fromEntries(new FormData(form)))
                });
                message.className = "message success";
                message.textContent = result.message;
                if (currentUser.account_type === "admin") {
                    await refreshAdmin(currentUser, currentPortalTab);
                } else {
                    await loadEmployeeDirectory();
                }
                document.querySelector("#userEditPanel").hidden = true;
            } catch (error) {
                message.textContent = error.message;
            }
        });
    }

    function bindProfileForm() {
        const form = document.querySelector("#profileDetailsForm");
        if (!form) {
            return;
        }
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const message = document.querySelector("#profileDetailsMessage");
            try {
                const result = await api("portal.php?action=update-profile", {
                    method: "POST",
                    body: JSON.stringify(Object.fromEntries(new FormData(form)))
                });
                message.className = "message success";
                message.textContent = result.message;
                const refreshed = await api("auth.php?action=me");
                currentUser = refreshed.user;
                renderPortal(currentUser, "profile");
            } catch (error) {
                message.className = "message";
                message.textContent = error.message;
            }
        });
    }

    async function loadPayments() {
        const container = document.querySelector("#paymentList");
        if (!container) {
            return;
        }
        try {
            const result = await api("portal.php?action=payments");
            container.innerHTML = result.payments.length
                ? `<div class="table-wrap"><table><thead><tr><th>Receipt</th><th>Booking</th><th>Service</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>
                    ${result.payments.map(payment => `
                        <tr>
                            <td>SSS-${String(payment.id).padStart(6, "0")}</td>
                            <td>#${payment.booking_id}</td>
                            <td>${escapeHTML(payment.service_type)}</td>
                            <td>${escapeHTML(formatMoney(payment.amount, payment.currency))}</td>
                            <td><span class="status">${escapeHTML(payment.status)}</span></td>
                            <td>${escapeHTML(payment.paid_at || payment.created_at)}</td>
                            <td><button class="btn small outline" data-print-receipt="${payment.id}" data-receipt-number="SSS-${String(payment.id).padStart(6, "0")}" data-receipt-customer="${escapeHTML(payment.customer_name || currentUser?.full_name || "")}" data-receipt-booking="${payment.booking_id}" data-receipt-service="${escapeHTML(payment.service_type)}" data-receipt-currency="${escapeHTML(payment.currency)}" data-receipt-amount="${Number(payment.amount).toFixed(2)}" data-receipt-status="${escapeHTML(payment.status)}" data-receipt-date="${escapeHTML(payment.paid_at || payment.created_at)}" data-receipt-method="${escapeHTML(payment.payment_method || "")}" data-receipt-reference="${escapeHTML(payment.reference_number || "")}">Print receipt</button></td>
                        </tr>
                    `).join("")}
                </tbody></table></div>`
                : '<p class="muted">There are no payment records yet.</p>';
        } catch (error) {
            container.textContent = error.message;
        }
    }

    function paymentRecordForm() {
        return `
            <section class="panel form-panel">
                <h2>Record a payment</h2>
                <form id="paymentForm">
                    <div class="form-row">
                        <label>Booking ID<input name="booking_id" type="number" min="1" required></label>
                        <label>Amount (PHP)<input name="amount" type="number" min="0.01" step="0.01" required></label>
                        <label>Status<select name="status"><option value="pending">Pending</option><option value="paid">Paid</option><option value="refunded">Refunded</option><option value="void">Void</option></select></label>
                    </div>
                    <div class="form-row">
                        <label>Payment method<input name="payment_method" maxlength="80" placeholder="Cash, bank transfer, etc."></label>
                        <label>Reference number<input name="reference_number" maxlength="100"></label>
                    </div>
                    <button class="btn primary" type="submit">Save payment record</button>
                    <p id="paymentMessage" class="message" role="status"></p>
                </form>
            </section>
        `;
    }

    function resetProductForm(form) {
        form.elements.id.value = "";
        form.elements.is_active.value = "1";
        form.closest(".form-panel").querySelector("#productFormTitle").textContent = "Add a solar product";
        form.querySelector('[type="submit"]').textContent = "Save product";
    }

    function bindPaymentForm() {
        const form = document.querySelector("#paymentForm");
        if (!form) {
            return;
        }
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const message = document.querySelector("#paymentMessage");
            try {
                const result = await api("portal.php?action=record-payment", {
                    method: "POST",
                    body: JSON.stringify(Object.fromEntries(new FormData(form)))
                });
                message.className = "message success";
                message.textContent = `${result.message} Receipt ${result.receipt_number}.`;
                form.reset();
                await loadPayments();
            } catch (error) {
                message.textContent = error.message;
            }
        });
    }

    function bindAnnouncementForm() {
        const form = document.querySelector("#announcementForm");
        if (!form) {
            return;
        }
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const message = document.querySelector("#announcementMessage");
            try {
                const result = await api("portal.php?action=create-announcement", {
                    method: "POST",
                    body: JSON.stringify(Object.fromEntries(new FormData(form)))
                });
                message.className = "message success";
                message.textContent = result.message;
                form.reset();
                await loadNotifications();
            } catch (error) {
                message.textContent = error.message;
            }
        });
    }

    async function loadTickets(manage = false) {
        const container = document.querySelector("#ticketList");
        if (!container) {
            return;
        }
        try {
            const result = await api("portal.php?action=tickets");
            container.innerHTML = result.tickets.length
                ? result.tickets.map(ticket => `
                    <article class="approval">
                        <div><b>#${ticket.id} · ${escapeHTML(ticket.subject)}</b><p>${escapeHTML(ticket.message)}</p><small>${escapeHTML(ticket.created_at)}</small></div>
                        ${manage ? `
                            <label class="compact-label">Status
                                <select data-ticket-status="${ticket.id}">
                                    ${["open", "in_progress", "resolved", "closed"].map(status => `<option value="${status}" ${ticket.status === status ? "selected" : ""}>${status.replace("_", " ")}</option>`).join("")}
                                </select>
                                <button class="btn small primary" data-save-ticket="${ticket.id}">Save</button>
                            </label>
                        ` : `<span class="status">${escapeHTML(ticket.status)}</span>`}
                    </article>
                `).join("")
                : '<p class="muted">No support requests yet.</p>';
        } catch (error) {
            container.textContent = error.message;
        }
    }

    function bindSupportForm() {
        const form = document.querySelector("#supportForm");
        if (!form) {
            return;
        }
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const message = document.querySelector("#supportMessage");
            try {
                const body = Object.fromEntries(new FormData(form));
                if (!body.booking_id) {
                    delete body.booking_id;
                }
                const result = await api("portal.php?action=create-ticket", {
                    method: "POST",
                    body: JSON.stringify(body)
                });
                message.className = "message success";
                message.textContent = result.message;
                form.reset();
                await loadTickets();
            } catch (error) {
                message.textContent = error.message;
            }
        });
    }

    function bindProfilePasswordForm() {
        const form = document.querySelector("#profilePasswordForm");
        if (!form) {
            return;
        }

        form.addEventListener("submit", async event => {
            event.preventDefault();
            const message = document.querySelector("#profilePasswordMessage");

            try {
                const result = await api("portal.php?action=change-password", {
                    method: "POST",
                    body: JSON.stringify(Object.fromEntries(new FormData(form)))
                });
                message.className = "message success";
                message.textContent = result.message;
                form.reset();
            } catch (error) {
                message.textContent = error.message;
            }
        });
    }

    async function loadNotifications() {
        const container = document.querySelector("#notifications");
        if (!container) {
            return;
        }

        try {
            const result = await api("portal.php?action=notifications");
            container.innerHTML = result.notifications.length
                ? result.notifications.map(notification => `
                    <article class="notice-card">
                       <span class="eyebrow">${notification.personal ? "BOOKING UPDATE" : escapeHTML(notification.audience || "TEAM UPDATE")} · ${escapeHTML(notification.created_at)}</span>
                        <h3>${escapeHTML(notification.title)}</h3>
                        <p>${escapeHTML(notification.message)}</p>
                       ${notification.personal && !notification.read_at ? `<button class="text-link" data-read-notification="${notification.id}">Mark as read</button>` : ""}
                   </article>
                `).join("")
                : '<p class="muted">No notifications yet.</p>';
        } catch (error) {
            container.textContent = error.message;
        }
    }

    // Build the table used for customer requests and worker jobs.
    function requestRows(
        requests,
        isAdmin = false,
        isWorker = false,
        canViewActivity = false,
        isCustomer = false,
        isDispatcher = false
    ) {
        if (!requests.length) {
            return '<p class="muted">No service requests yet.</p>';
        }

        return `
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Request</th>
                            <th>Customer</th>
                            <th>Service / address</th>
                            <th>Status</th>
                            <th>Details / action</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${requests.map(request => `
                            <tr>
                                <td>
                                    #${request.id}<br>
                                    <small>${escapeHTML(request.created_at)}</small>
                                </td>

                                <td>
                                    ${escapeHTML(request.customer_name || "You")}

                                    ${request.worker_name ? `
                                        <br>
                                        <small>
                                            Worker: ${escapeHTML(request.worker_name)}
                                        </small>
                                    ` : ""}
                                    ${!isCustomer && request.customer_phone ? `
                                        <br><small>${escapeHTML(request.customer_phone)}</small>
                                        <br><small>${escapeHTML(request.customer_email || "")}</small>
                                    ` : ""}
                                </td>

                                <td>
                                    <b>${escapeHTML(request.service_type)}</b>
                                    <br>
                                    ${escapeHTML(request.address)}
                                    <br>
                                    <small>
                                        ${request.scheduled_date || request.preferred_date
                                            ? `${["scheduled", "in_progress", "completed"].includes(request.status) ? "Scheduled:" : "Preferred:"} ${escapeHTML(request.scheduled_date || request.preferred_date)}`
                                            : "Date: Flexible"}
                                        ${request.start_time
                                            ? ` · ${escapeHTML(request.start_time.slice(0, 5))}${request.end_time
                                                ? `–${escapeHTML(request.end_time.slice(0, 5))}`
                                                : ""}`
                                            : ""}
                                    </small>
                                </td>

                                <td>
                                    <span class="status status-${escapeHTML(request.status)}">
                                        ${escapeHTML(request.status.replace("_", " "))}
                                    </span>
                                </td>

                                <td>
                                    ${isAdmin || isDispatcher ? `
                                        <label class="compact-label">
                                            Assign worker

                                            <select data-assign-select="${request.id}">
                                                <option value="">Select worker</option>

                                                ${(window.__workers || []).map(worker => `
                                                    <option
                                                        value="${worker.id}"
                                                        ${Number(request.assigned_employee_id) === Number(worker.id)
                                                            ? "selected"
                                                            : ""}
                                                    >
                                                        ${escapeHTML(worker.full_name)}
                                                        ·
                                                        ${escapeHTML(worker.department)}
                                                    </option>
                                                `).join("")}
                                            </select>
                                        </label>

                                        <label class="compact-label">
                                            Service date
                                            <input
                                                type="date"
                                                data-schedule-date="${request.id}"
                                                value="${escapeHTML(request.scheduled_date || request.preferred_date || "")}"
                                                min="${new Date().toISOString().slice(0, 10)}"
                                                required
                                            >
                                        </label>

                                        <div class="form-row compact-time">
                                            <label class="compact-label">Start
                                                <input type="time" data-schedule-start="${request.id}"
                                                    value="${escapeHTML((request.start_time || "").slice(0, 5))}" required>
                                            </label>
                                            <label class="compact-label">End
                                                <input type="time" data-schedule-end="${request.id}"
                                                    value="${escapeHTML((request.end_time || "").slice(0, 5))}" required>
                                            </label>
                                        </div>

                                        <button
                                            class="btn small primary"
                                            data-assign="${request.id}"
                                        >
                                            Save assignment
                                        </button>
                                        ${request.status === "submitted" ? `
                                            <button class="btn small danger"
                                                data-decline="${request.id}">Decline request</button>
                                        ` : ""}
                                    ` : isCustomer ? `
                                        ${["submitted", "scheduled"].includes(request.status) ? `
                                            <div class="job-actions">
                                                <button class="btn small outline" data-reschedule-request="${request.id}">Request reschedule</button>
                                                <button class="btn small danger" data-cancel-booking="${request.id}">Cancel booking</button>
                                            </div>
                                        ` : ""}
                                        <small>${escapeHTML(request.worker_notes || "No service notes yet")}</small>
                                    ` : isWorker ? `
                                                        <div class="job-actions">
                                                            <button
                                                                class="btn small outline"
                                                                data-work-event="check_in"
                                                                data-request-id="${request.id}"
                                                            >Check in · share GPS location</button>

                                                            <button
                                                                class="btn small outline"
                                                                data-work-event="check_out"
                                                                data-request-id="${request.id}"
                                                            >Check out</button>
                                                        </div>
                                                        <p class="muted">The browser will ask permission to capture your location at site check-in.</p>

                                                        <label class="compact-label">
                                                            Service report or issue
                                                            <select data-issue-type="${request.id}">
                                                                <option value="service">Service report</option>
                                                                <option value="equipment_problem">Equipment problem</option>
                                                                <option value="site_issue">Site issue</option>
                                                            </select>
                                                            <textarea
                                                                data-issue-note="${request.id}"
                                                                rows="2"
                                                                maxlength="4000"
                                                                placeholder="Describe work completed, equipment problems, or site issues"
                                                            ></textarea>
                                                        </label>

                                                        <button
                                                            class="btn small danger"
                                                            data-work-event="issue"
                                                            data-request-id="${request.id}"
                                                        >Submit service report</button>

                                                        <label class="compact-label">
                                                            Update status

                                            <select data-job-status="${request.id}">
                                                <option value="scheduled"
                                                    ${request.status === "scheduled" ? "selected" : ""}>
                                                    Scheduled
                                                </option>

                                                <option value="in_progress"
                                                    ${request.status === "in_progress" ? "selected" : ""}>
                                                    In progress
                                                </option>

                                                <option value="completed"
                                                    ${request.status === "completed" ? "selected" : ""}>
                                                    Completed
                                                </option>

                                                <option value="cancelled"
                                                    ${request.status === "cancelled" ? "selected" : ""}>
                                                    Cancelled
                                                </option>
                                            </select>
                                        </label>

                                        <textarea
                                            data-job-notes="${request.id}"
                                            rows="2"
                                            placeholder="Work notes"
                                        >${escapeHTML(request.worker_notes || "")}</textarea>

                                        <button
                                            class="btn small primary"
                                            data-update-job="${request.id}"
                                        >
                                            Save update
                                        </button>
                                    ` : `
                                        <small>
                                            ${escapeHTML(request.worker_notes || "No updates yet")}
                                        </small>
                                    `}
                                    ${isAdmin || isWorker || canViewActivity ? `
                                        <button class="text-link activity-toggle"
                                            data-activity-request="${request.id}">Activity & reports</button>
                                        <div class="activity-list"
                                            data-activity-container="${request.id}" hidden></div>
                                    ` : ""}
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    }

    async function loadRequests() {
        const container = document.querySelector("#myRequests");

        if (!container) {
            return;
        }

        try {
            const result = await api("request.php?action=list");

            const isWorker =
                currentUser?.account_type === "employee" &&
                userHasRole(currentUser, "technician");
            const canViewActivity =
                currentUser?.account_type === "employee" &&
                (userHasRole(currentUser, "technician") || userHasRole(currentUser, "dispatcher"));
            const isDispatcher =
                currentUser?.account_type === "employee" &&
                userHasRole(currentUser, "dispatcher");
            if (isDispatcher) {
                window.__workers = (await api("admin.php?action=workers")).workers;
            }

            container.innerHTML = requestRows(
                result.requests,
                false,
                Boolean(isWorker),
                Boolean(canViewActivity),
                currentUser?.account_type === "customer",
                Boolean(isDispatcher)
            );
        } catch (error) {
            container.textContent = error.message;
        }
    }

    // Administrator workspace pages.
    async function adminPage(user = currentUser, tab = "overview") {
        currentPortalTab = tab;
        const navigation = [
            ["overview", "Overview", "01"],
            ["users", "User management", "02"],
            ["dispatch", "Dispatch calendar", "03"],
            ["reports", "Reports & analytics", "04"],
            ["notifications", "Notifications", "05"],
            ["settings", "Service settings", "06"],
            ["products", "Product catalog", "07"],
            ["support", "Customer support", "08"],
            ["payments", "Payments & receipts", "09"]
        ];
        const page = {
            overview: ["ADMINISTRATION PORTAL", "The right team. The right time.", "One workspace for customer bookings, employee approvals and field assignment."],
            users: ["ADMINISTRATION / USER MANAGEMENT", "The people behind the sunshine.", "Customers self-register. Only HR and administrators can provision employee accounts."],
            dispatch: ["ADMINISTRATION / DISPATCH CALENDAR", "The right team. The right time.", "Coordinate customer bookings, approvals and field assignments."],
            reports: ["ADMINISTRATION / REPORTS & ANALYTICS", "Insight for your next bright move.", "Service activity and request trends from your workspace."],
            notifications: ["ADMINISTRATION / NOTIFICATIONS", "The right message, right on time.", "Create portal notices for customers, employees or the field team."],
            settings: ["ADMINISTRATION / SERVICE SETTINGS", "Set your service standards.", "Manage appointment availability and the services customers can request."],
            products: ["ADMINISTRATION / PRODUCT CATALOG", "Show customers what’s available.", "Manage solar panels, inverters, batteries and installation components."],
            support: ["ADMINISTRATION / CUSTOMER SUPPORT", "Every concern deserves a response.", "Review customer support requests and keep cases moving."],
            payments: ["ADMINISTRATION / ACCOUNTING", "Clear records, clear receipts.", "Record offline payment status and provide customer receipt references."]
        }[tab] || ["ADMINISTRATION PORTAL", "Operations dashboard", "Manage your Sun Son Solar workspace."];

        let content = `
            <section class="page-heading">
                <div>
                    <span class="eyebrow">${page[0]}</span>
                    <h1>${page[1]}</h1>
                    <p>${page[2]}</p>
                </div>
                ${tab === "dispatch" ? '<button class="btn primary" data-action="portal-tab" data-tab="users">Review users ↗</button>' : ""}
            </section>
        `;

        if (tab === "overview") {
            content += `
                <div class="stats" id="adminStats">${statCard("Customer bookings", "...")}${statCard("Pending approvals", "...")}${statCard("Completed services", "...")}</div>
                <div class="admin-grid">
                    <section class="panel"><div class="panel-title"><h2>Pending employee applications</h2><button class="btn outline small" data-action="portal-tab" data-tab="users">Review all</button></div><div id="pendingList">Loading...</div></section>
                    <section class="panel"><div class="panel-title"><h2>Service requests</h2><button class="btn outline small" data-action="portal-tab" data-tab="dispatch">Open dispatch</button></div><div id="allRequests">Loading...</div></section>
                </div>
            `;
        } else if (tab === "users") {
            content += `
                ${employeeCreateForm()}
                <div class="panel">
                    <div class="panel-title"><div><span class="eyebrow">REVIEW QUEUE</span><h2>Legacy pending employee applications</h2></div></div>
                    <div id="pendingList">Loading...</div>
                </div>
                <div class="panel">
                    <div class="panel-title"><div><span class="eyebrow">USER DIRECTORY</span><h2>Customer & employee accounts</h2></div></div>
                    <div id="employeeList">Loading...</div>
                </div>
                ${userEditForm()}
            `;
        } else if (tab === "dispatch") {
            content += `
                <div class="stats" id="dispatchStats">${statCard("Scheduled", "...")}${statCard("Unassigned", "...")}${statCard("Technicians", "...")}</div>
                <section class="panel">
                    <div class="panel-title"><div><span class="eyebrow">BOOKINGS / PHT</span><h2>Service calendar & assignments</h2></div></div>
                    <p class="muted">Requests are shown by their preferred date. Assign an approved technician or dispatch employee to schedule the work.</p>
                    <div id="allRequests">Loading bookings...</div>
                </section>
            `;
        } else if (tab === "reports") {
            content += `
                <div class="report-filters"><span>Service: All</span><span>Snapshot: Current workspace</span><button class="btn outline small" data-action="refresh-report">Refresh report</button></div>
                <div class="stats" id="reportStats">${statCard("Active customers", "...")}${statCard("Service requests", "...")}${statCard("Completed services", "...")}${statCard("Pending approvals", "...")}${statCard("Recorded revenue", "...")}${statCard("Site check-ins", "...")}${statCard("Open concerns", "...")}</div>
                <div class="admin-grid">
                    <section class="panel"><h2>Service usage & customer activity</h2><div id="serviceChart" class="service-chart">Loading...</div></section>
                    <section class="panel"><h2>Request status</h2><div id="statusChart" class="status-chart"></div></section>
                </div>
                <section class="panel"><h2>Payment reporting</h2><p class="muted">Revenue reflects records manually marked paid by Accounting. It is not a live payment gateway or bank reconciliation report.</p></section>
            `;
        } else if (tab === "notifications") {
            content += `
                <div class="admin-grid">
                    <section class="panel">
                        <h2>Customer notification</h2>
                        <form id="notificationForm">
                            <label>Notice type<select name="audience"><option value="customers">Customer update</option><option value="all">All portal users</option><option value="technicians">Technician notice</option><option value="employees">Staff announcement</option></select></label>
                            <label>Title<input name="title" maxlength="160" required></label>
                            <label>Message<textarea name="message" rows="4" maxlength="4000" required></textarea></label>
                            <label>Delivery<select name="channel"><option value="portal">Portal inbox</option><option value="email_sms" disabled>Email + SMS (provider not configured)</option></select></label>
                            <label>Send at (optional)<input name="scheduled_at" type="datetime-local"></label>
                            <button class="btn primary" type="submit">Publish portal notice</button>
                            <p id="notificationMessage" class="message" role="status"></p>
                        </form>
                    </section>
                    <section class="panel"><h2>Recent notifications</h2><div id="notificationList">Loading...</div></section>
                </div>
            `;
        } else if (tab === "products") {
            content += `
                <section class="panel form-panel">
                    <h2 id="productFormTitle">Add a solar product</h2>
                    <form id="productForm">
                        <input name="id" type="hidden">
                        <input name="is_active" type="hidden" value="1">
                        <div class="form-row">
                            <label>Product name<input name="name" maxlength="160" required></label>
                            <label>Category<select name="category" required>
                                <option value="solar_panel">Solar panel</option><option value="inverter">Inverter</option><option value="battery">Battery</option><option value="mounting_equipment">Mounting equipment</option><option value="wire">Wire and cable</option><option value="other">Other</option>
                            </select></label>
                        </div>
                        <label>Description<textarea name="description" rows="3" maxlength="4000" required></textarea></label>
                        <div class="form-row">
                            <label>Price (optional, PHP)<input name="price" type="number" min="0" step="0.01"></label>
                            <label>Availability<select name="availability"><option value="quote_required">Quote required</option><option value="available">Available</option><option value="unavailable">Unavailable</option></select></label>
                            <label>Image URL (optional)<input name="image_url" type="url" maxlength="500"></label>
                        </div>
                        <button class="btn primary" type="submit">Save product</button>
                        <button class="btn outline" type="reset">Clear form</button>
                        <p id="productMessage" class="message" role="status"></p>
                    </form>
                </section>
                <section class="panel"><h2>Manage product catalog</h2><div id="productList">Loading products...</div></section>
                <section class="panel form-panel">
                    <h2>Publish a verified customer story</h2>
                    <form id="testimonialForm">
                        <input name="id" type="hidden">
                        <label>Customer display name<input name="customer_name" maxlength="120" required></label>
                        <label>Testimonial<textarea name="quote" rows="3" maxlength="2000" required></textarea></label>
                        <div class="form-row">
                            <label>Rating<select name="rating"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>
                            <label>Publication status<select name="status"><option value="draft">Draft</option><option value="published">Published</option></select></label>
                        </div>
                        <button class="btn primary" type="submit">Save customer story</button>
                        <p id="testimonialMessage" class="message" role="status"></p>
                    </form>
                </section>
                <section class="panel"><h2>Customer stories</h2><div id="testimonialList">Loading testimonials...</div></section>
            `;
        } else if (tab === "support") {
            content += `<section class="panel"><h2>Customer support tickets</h2><div id="ticketList">Loading tickets...</div></section>`;
        } else if (tab === "payments") {
            content += `
                <section class="panel"><p class="muted">Payment entries here record manually collected payments only. No payment provider is connected.</p></section>
                ${paymentRecordForm()}
                <section class="panel"><h2>Payment records</h2><div id="paymentList">Loading payment records...</div></section>
            `;
        } else {
            content += `
                <section class="panel">
                    <h2>Booking availability</h2>
                    <form id="serviceSettingsForm">
                        <div id="bookingSettings" class="form-row">Loading settings...</div>
                        <h3>Service categories & pricing</h3>
                        <div id="serviceCatalog">Loading services...</div>
                        <button class="btn primary" type="submit">Save service settings</button>
                        <p id="settingsMessage" class="message" role="status"></p>
                    </form>
                </section>
                <section class="panel form-panel">
                    <h2>Add or update a service</h2>
                    <form id="serviceForm">
                        <label>Service name<input name="name" maxlength="80" required></label>
                        <label>Description<textarea name="description" rows="3" maxlength="4000" required></textarea></label>
                        <div class="form-row">
                            <label>Price (optional, PHP)<input name="price" type="number" min="0" step="0.01"></label>
                            <label>Price label<input name="price_label" maxlength="120" value="Quotation required" required></label>
                            <label>Available for booking<select name="is_available"><option value="1">Yes</option><option value="0">No</option></select></label>
                        </div>
                        <button class="btn primary" type="submit">Save service</button>
                        <p id="serviceMessage" class="message" role="status"></p>
                    </form>
                </section>
                <section class="panel">
                    <h2>Change administrator password</h2>
                    <form id="passwordForm" class="password-form">
                        <label>Current password<input type="password" name="current_password" required></label>
                        <label>New password (10+ characters)<input type="password" name="new_password" minlength="10" required></label>
                        <button class="btn primary">Change password</button>
                        <p id="passwordMessage" class="message" role="status"></p>
                    </form>
                </section>
            `;
        }

        portalShell(user, tab, content, navigation, "Administration portal");
        await refreshAdmin(user, tab);
        bindAdminForms(user, tab);
    }

    function pendingMarkup(users) {
        return users.length
            ? users.map(user => `
                <article class="approval">
                    <div>
                        <b>${escapeHTML(user.full_name)}</b>
                        <p>${escapeHTML(user.email)} · ${escapeHTML(user.phone)} · ${escapeHTML(user.department)}</p>
                        <small>Applied ${escapeHTML(user.created_at)}</small>
                    </div>
                    <div class="row-actions">
                        <button class="btn primary small" data-decision="approve" data-id="${user.id}">Approve</button>
                        <button class="btn danger small" data-decision="reject" data-id="${user.id}">Reject</button>
                    </div>
                </article>
            `).join("")
            : '<p class="muted">No pending applications.</p>';
    }

    function employeeMarkup(users) {
        return users.length
            ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Email / phone</th><th>Role / department</th><th>Status</th><th>Account</th></tr></thead><tbody>
                ${users.map(user => `<tr data-user-id="${user.id}"
                    data-user-type="${escapeHTML(user.account_type)}"
                    data-user-first="${escapeHTML(user.first_name || "")}"
                    data-user-middle="${escapeHTML(user.middle_name || "")}"
                    data-user-last="${escapeHTML(user.last_name || "")}"
                    data-user-username="${escapeHTML(user.username || "")}"
                    data-user-email="${escapeHTML(user.email)}"
                    data-user-phone="${escapeHTML(user.phone)}"
                    data-user-gender="${escapeHTML(user.gender)}"
                    data-user-birthdate="${escapeHTML(user.birthdate || "")}"
                    data-user-address="${escapeHTML(user.address || "")}"
                    data-user-role="${escapeHTML((user.role_names || "").split(",")[0]?.trim() || "employee")}"
                    data-user-department="${escapeHTML(user.department || "")}">
                    <td>${escapeHTML(user.full_name)}</td>
                    <td>${escapeHTML(user.username || "—")}</td>
                    <td>${escapeHTML(user.email)}<br>${escapeHTML(user.phone)}</td>
                    <td>${escapeHTML((user.role_names || user.account_type).replaceAll(",", ", "))}${user.department ? `<br><small>${escapeHTML(user.department)}</small>` : ""}</td>
                    <td><span class="status status-${escapeHTML(user.status)}">${escapeHTML(user.status)}</span></td>
                    <td><button class="btn small outline" data-edit-user="${user.id}">Edit</button>
                    ${user.status === "inactive"
                        ? `<button class="btn small outline" data-user-status="active" data-id="${user.id}">Reactivate</button>`
                        : `<button class="btn small danger" data-user-status="inactive" data-id="${user.id}">Deactivate</button>`}</td>
                </tr>`).join("")}
                </tbody></table></div>`
            : '<p class="muted">No accounts found.</p>';
    }

    function settingField(item) {
        const key = item.setting_key;
        const value = item.setting_value;
        const label = key.replaceAll("_", " ");
        const options = {
            working_days: ["Monday-Friday", "Monday-Saturday", "Daily"],
            minimum_booking_notice: ["0 hours", "24 hours", "48 hours", "72 hours"],
            technician_capacity: [
                "1 active job per time slot",
                "2 active jobs per time slot",
                "3 active jobs per time slot"
            ]
        };

        if (options[key]) {
            return `
                <label>${escapeHTML(label)}
                    <select data-setting="${escapeHTML(key)}" required>
                        ${options[key].map(option => `
                            <option value="${escapeHTML(option)}" ${value === option ? "selected" : ""}>
                                ${escapeHTML(option)}
                            </option>
                        `).join("")}
                    </select>
                </label>
            `;
        }

        if (key === "opening_time" || key === "closing_time") {
            return `
                <label>${escapeHTML(label)}
                    <input data-setting="${escapeHTML(key)}" type="time"
                        value="${escapeHTML(value.slice(0, 5))}" required>
                </label>
            `;
        }

        if (key === "consultation_slot_minutes") {
            return `
                <label>${escapeHTML(label)}
                    <input data-setting="${escapeHTML(key)}" type="number"
                        min="30" max="240" step="15" value="${escapeHTML(value)}" required>
                </label>
            `;
        }

        return `
            <label>${escapeHTML(label)}
                <input data-setting="${escapeHTML(key)}"
                    value="${escapeHTML(value)}" maxlength="255" required>
            </label>
        `;
    }

    async function refreshAdmin(user = currentUser, tab = currentPortalTab) {
        try {
            if (tab === "overview") {
                const [pending, requests, reports] = await Promise.all([
                    api("admin.php?action=pending"),
                    api("request.php?action=list"),
                    api("portal.php?action=reports")
                ]);
                document.querySelector("#adminStats").innerHTML =
                    statCard("Customer bookings", requests.requests.length, "All service requests") +
                    statCard("Pending approvals", pending.users.length, "Need review") +
                    statCard("Completed services", reports.requests.completed || 0, "Marked completed");
                document.querySelector("#pendingList").innerHTML = pendingMarkup(pending.users);
                window.__workers = (await api("admin.php?action=workers")).workers;
                document.querySelector("#allRequests").innerHTML =
                    requests.requests.length
                        ? requestRows(requests.requests.slice(0, 5), true)
                        : '<p class="muted">No service requests yet.</p>';
            } else if (tab === "users") {
                const [pending, users] = await Promise.all([
                    api("admin.php?action=pending"),
                    api("admin.php?action=users")
                ]);
                document.querySelector("#pendingList").innerHTML = pendingMarkup(pending.users);
                document.querySelector("#employeeList").innerHTML = employeeMarkup(users.users);
            } else if (tab === "dispatch") {
                const [workers, requests] = await Promise.all([
                    api("admin.php?action=workers"),
                    api("request.php?action=list")
                ]);
                window.__workers = workers.workers;
                const scheduled = requests.requests.filter(item => item.status === "scheduled").length;
                const unassigned = requests.requests.filter(item => !item.assigned_employee_id).length;
                document.querySelector("#dispatchStats").innerHTML =
                    statCard("Scheduled", scheduled, "Confirmed field work") +
                    statCard("Unassigned", unassigned, "Needs a technician") +
                    statCard("Technicians", workers.workers.length, "Approved field team");
                document.querySelector("#allRequests").innerHTML =
                    requestRows(requests.requests, true);
            } else if (tab === "reports") {
                const result = await api("portal.php?action=reports");
                const count = (value) => Number(value || 0);
                document.querySelector("#reportStats").innerHTML =
                    statCard("Active customers", count(result.users.customers), "Registered customer accounts") +
                    statCard("Service requests", count(result.requests.total), "All-time requests") +
                    statCard("Completed services", count(result.requests.completed), "Marked completed") +
                    statCard("Pending approvals", count(result.users.pending), "Legacy employee applications") +
                    statCard("Recorded revenue", `PHP ${count(result.payments.paid_total).toLocaleString()}`, `${count(result.payments.paid_records)} paid records`) +
                    statCard("Site check-ins", count(result.operations.check_ins), "GPS-assisted attendance records") +
                    statCard("Open concerns", count(result.operations.open_tickets), "Customer support tickets");
                const max = Math.max(1, ...result.services.map(item => count(item.total)));
                document.querySelector("#serviceChart").innerHTML =
                    result.services.length
                        ? result.services.map(item => `
                            <div class="chart-row">
                                <span>${escapeHTML(item.service_type)}</span>
                                <div><i style="width:${Math.round(count(item.total) / max * 100)}%"></i></div>
                                <b>${count(item.total)}</b>
                            </div>
                        `).join("")
                        : '<p class="muted">No service activity to report yet.</p>';
                document.querySelector("#statusChart").innerHTML = [
                    ["Submitted", result.requests.submitted],
                    ["Scheduled", result.requests.scheduled],
                    ["In progress", result.requests.in_progress],
                    ["Completed", result.requests.completed]
                ].map(([label, value]) => `
                    <div class="status-line"><span>${escapeHTML(label)}</span><b>${count(value)}</b></div>
                `).join("");
            } else if (tab === "notifications") {
                const result = await api("portal.php?action=notifications");
                document.querySelector("#notificationList").innerHTML =
                    result.notifications.length
                        ? result.notifications.map(item => `
                            <article class="notice-card">
                                <span class="eyebrow">${escapeHTML(item.audience)} · ${escapeHTML(item.status)}</span>
                                <h3>${escapeHTML(item.title)}</h3>
                                <p>${escapeHTML(item.message)}</p>
                                <small>${escapeHTML(item.scheduled_at || item.created_at)}</small>
                            </article>
                        `).join("")
                        : '<p class="muted">No notifications have been published.</p>';
            } else if (tab === "settings") {
                const result = await api("portal.php?action=settings");
                document.querySelector("#bookingSettings").innerHTML =
                    result.settings.map(settingField).join("");
                document.querySelector("#serviceCatalog").innerHTML =
                    `<div class="table-wrap"><table><thead><tr><th>Service</th><th>Demo price / unit</th><th>Bookable</th></tr></thead><tbody>
                    ${result.services.map(item => `
                        <tr data-service-row="${escapeHTML(item.service_type)}">
                            <td><b>${escapeHTML(item.service_type)}</b></td>
                            <td><input data-price-label value="${escapeHTML(item.price_label)}" maxlength="120" required></td>
                            <td><input data-booking-enabled type="checkbox" ${Number(item.booking_enabled) ? "checked" : ""} aria-label="Enable ${escapeHTML(item.service_type)} bookings"></td>
                        </tr>
                    `).join("")}
                    </tbody></table></div>`;
            } else if (tab === "products") {
                const [result, testimonialResult] = await Promise.all([
                    api("catalog.php?action=products"),
                    api("catalog.php?action=testimonials")
                ]);
                const container = document.querySelector("#productList");
                container.innerHTML = result.products.length
                    ? `<div class="table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Availability</th><th>Active</th><th>Actions</th></tr></thead><tbody>
                        ${result.products.map(product => `
                            <tr data-product-id="${product.id}"
                                data-product-name="${escapeHTML(product.name)}"
                                data-product-category="${escapeHTML(product.category)}"
                                data-product-description="${escapeHTML(product.description)}"
                                data-product-price="${escapeHTML(product.price ?? "")}"
                                data-product-availability="${escapeHTML(product.availability)}"
                                data-product-image="${escapeHTML(product.image_url || "")}"
                                data-product-active="${Number(product.is_active) ? "1" : "0"}">
                                <td>${escapeHTML(product.name)}</td><td>${escapeHTML(product.category.replaceAll("_", " "))}</td>
                                <td>${product.price === null ? "Quote required" : `PHP ${Number(product.price).toLocaleString()}`}</td>
                                <td>${escapeHTML(product.availability.replaceAll("_", " "))}</td>
                                <td>${Number(product.is_active) ? "Yes" : "No"}</td>
                                <td><button class="btn small outline" data-edit-product="${product.id}">Edit</button>
                                    <button class="btn small ${Number(product.is_active) ? "danger" : "primary"}" data-toggle-product="${product.id}" data-active="${Number(product.is_active) ? 0 : 1}">${Number(product.is_active) ? "Deactivate" : "Reactivate"}</button></td>
                            </tr>
                        `).join("")}
                    </tbody></table></div>`
                    : '<p class="muted">No products listed yet.</p>';
                document.querySelector("#testimonialList").innerHTML =
                    testimonialResult.testimonials.length
                        ? `<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Story</th><th>Rating</th><th>Status</th><th></th></tr></thead><tbody>
                            ${testimonialResult.testimonials.map(item => `
                                <tr data-testimonial-id="${item.id}" data-testimonial-name="${escapeHTML(item.customer_name)}" data-testimonial-quote="${escapeHTML(item.quote)}" data-testimonial-rating="${item.rating}" data-testimonial-status="${escapeHTML(item.status)}">
                                    <td>${escapeHTML(item.customer_name)}</td><td>${escapeHTML(item.quote)}</td><td>${item.rating}/5</td><td>${escapeHTML(item.status)}</td>
                                    <td><button class="btn small outline" data-edit-testimonial="${item.id}">Edit</button></td>
                                </tr>
                            `).join("")}
                        </tbody></table></div>`
                        : '<p class="muted">No customer stories added yet.</p>';
            } else if (tab === "support") {
                await loadTickets(true);
            } else if (tab === "payments") {
                await loadPayments();
            }
        } catch (error) {
            const container = document.querySelector(".portal-content");
            if (container) {
                const notice = document.createElement("p");
                notice.className = "message";
                notice.textContent = error.message;
                container.prepend(notice);
            }
        }
    }

    function bindAdminForms(user, tab) {
        bindEmployeeForm();
        bindUserEditForm();

        const notificationForm = document.querySelector("#notificationForm");
        if (notificationForm) {
            notificationForm.addEventListener("submit", async event => {
                event.preventDefault();
                const message = document.querySelector("#notificationMessage");
                try {
                    const result = await api("portal.php?action=create-notification", {
                        method: "POST",
                        body: JSON.stringify(Object.fromEntries(new FormData(notificationForm)))
                    });
                    message.className = "message success";
                    message.textContent = result.message;
                    notificationForm.reset();
                    await refreshAdmin(user, tab);
                } catch (error) {
                    message.textContent = error.message;
                }
            });
        }

        const settingsForm = document.querySelector("#serviceSettingsForm");
        if (settingsForm) {
            settingsForm.addEventListener("submit", async event => {
                event.preventDefault();
                const message = document.querySelector("#settingsMessage");
                const settings = Object.fromEntries(
                    [...settingsForm.querySelectorAll("[data-setting]")].map(input => [
                        input.dataset.setting,
                        input.value
                    ])
                );
                const services = [...settingsForm.querySelectorAll("[data-service-row]")].map(row => ({
                    service_type: row.dataset.serviceRow,
                    price_label: row.querySelector("[data-price-label]").value,
                    booking_enabled: row.querySelector("[data-booking-enabled]").checked
                }));
                try {
                    const result = await api("portal.php?action=save-settings", {
                        method: "POST",
                        body: JSON.stringify({ settings, services })
                    });
                    message.className = "message success";
                    message.textContent = result.message;
                } catch (error) {
                    message.textContent = error.message;
                }

            });
        }

        const serviceForm = document.querySelector("#serviceForm");
        if (serviceForm) {
            serviceForm.addEventListener("submit", async event => {
                event.preventDefault();
                const message = document.querySelector("#serviceMessage");
                const data = Object.fromEntries(new FormData(serviceForm));
                data.is_available = data.is_available === "1";
                if (data.price === "") {
                    data.price = null;
                }
                try {
                    const result = await api("catalog.php?action=save-service", {
                        method: "POST",
                        body: JSON.stringify(data)
                    });
                    message.className = "message success";
                    message.textContent = result.message;
                    serviceForm.reset();
                    await refreshAdmin(user, tab);
                } catch (error) {
                    message.textContent = error.message;
                }
            });
        }

        const productForm = document.querySelector("#productForm");
        if (productForm) {
            productForm.addEventListener("submit", async event => {
                event.preventDefault();
                const message = document.querySelector("#productMessage");
                const data = Object.fromEntries(new FormData(productForm));
                data.is_active = productForm.elements.is_active.value === "1";
                if (!data.id) {
                    delete data.id;
                }
                if (data.price === "") {
                    data.price = null;
                }
                try {
                    const result = await api("catalog.php?action=save-product", {
                        method: "POST",
                        body: JSON.stringify(data)
                    });
                    message.className = "message success";
                    message.textContent = result.message;
                    productForm.reset();
                    resetProductForm(productForm);
                    await refreshAdmin(user, tab);
                } catch (error) {
                    message.textContent = error.message;
                }
            });

            productForm.addEventListener("reset", () => {
                resetProductForm(productForm);
            });
        }

        const testimonialForm = document.querySelector("#testimonialForm");
        if (testimonialForm) {
            testimonialForm.addEventListener("submit", async event => {
                event.preventDefault();
                const message = document.querySelector("#testimonialMessage");
                const data = Object.fromEntries(new FormData(testimonialForm));
                if (!data.id) {
                    delete data.id;
                }
                try {
                    const result = await api("catalog.php?action=save-testimonial", {
                        method: "POST",
                        body: JSON.stringify(data)
                    });
                    message.className = "message success";
                    message.textContent = result.message;
                    testimonialForm.reset();
                    await refreshAdmin(user, tab);
                } catch (error) {
                    message.textContent = error.message;
                }
            });
        }

        bindPaymentForm();

        const passwordForm = document.querySelector("#passwordForm");
        if (passwordForm) {
            passwordForm.addEventListener("submit", async event => {
                event.preventDefault();
                const message = document.querySelector("#passwordMessage");
                try {
                    const result = await api("admin.php?action=change-password", {
                        method: "POST",
                        body: JSON.stringify(Object.fromEntries(new FormData(passwordForm)))
                    });
                    message.className = "message success";
                    message.textContent = result.message;
                    passwordForm.reset();
                } catch (error) {
                    message.textContent = error.message;
                }
            });
        }
    }

    // Buttons for approvals, assignments, updates and navigation.
    app.addEventListener("click", async event => {
        const printReceipt = event.target.closest("[data-print-receipt]");
        if (printReceipt) {
            const receiptWindow = window.open("", "_blank", "width=720,height=800");
            if (!receiptWindow) {
                showMessage("Allow pop-ups to print the receipt.", true);
                return;
            }
            receiptWindow.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Receipt ${escapeHTML(printReceipt.dataset.receiptNumber)}</title><style>body{max-width:680px;margin:48px auto;padding:24px;font:16px Arial,sans-serif;color:#173f32}header{border-bottom:2px solid #173f32;padding-bottom:18px}small{color:#69766c}table{width:100%;margin:28px 0;border-collapse:collapse}td{padding:12px 0;border-bottom:1px solid #ddd}td:last-child{text-align:right;font-weight:bold}.total{font-size:22px}footer{margin-top:42px;color:#69766c;font-size:12px}@media print{button{display:none}}</style></head><body><header><h1>Sun Son Solar</h1><small>Payment record / receipt</small></header><p><b>Receipt:</b> ${escapeHTML(printReceipt.dataset.receiptNumber)}<br><b>Date:</b> ${escapeHTML(printReceipt.dataset.receiptDate)}${printReceipt.dataset.receiptCustomer ? `<br><b>Customer:</b> ${escapeHTML(printReceipt.dataset.receiptCustomer)}` : ""}</p><table><tr><td>Booking #${escapeHTML(printReceipt.dataset.receiptBooking)}<br><small>${escapeHTML(printReceipt.dataset.receiptService)}</small></td><td>${escapeHTML(printReceipt.dataset.receiptStatus)}</td></tr><tr><td class="total">Recorded amount</td><td class="total">${escapeHTML(formatMoney(printReceipt.dataset.receiptAmount, printReceipt.dataset.receiptCurrency))}</td></tr>${printReceipt.dataset.receiptMethod ? `<tr><td>Payment method</td><td>${escapeHTML(printReceipt.dataset.receiptMethod)}</td></tr>` : ""}${printReceipt.dataset.receiptReference ? `<tr><td>Reference</td><td>${escapeHTML(printReceipt.dataset.receiptReference)}</td></tr>` : ""}</table><footer>This is a record of a manually recorded payment, not a payment provider confirmation.<br>Sun Son Solar · Pasig City, Philippines</footer><script>window.onload=()=>window.print();</script></body></html>`);
            receiptWindow.document.close();
            return;
        }

        const readNotification = event.target.closest("[data-read-notification]");
        if (readNotification) {
            try {
                const result = await api("portal.php?action=mark-notification-read", {
                    method: "POST",
                    body: JSON.stringify({ id: Number(readNotification.dataset.readNotification) })
                });
                showMessage(result.message);
                await loadNotifications();
            } catch (error) {
                showMessage(error.message, true);
            }
            return;
        }

        const closeEdit = event.target.closest("[data-close-user-edit]");
        if (closeEdit) {
            document.querySelector("#userEditPanel").hidden = true;
            return;
        }

        const editUser = event.target.closest("[data-edit-user]");
        if (editUser) {
            const row = editUser.closest("[data-user-id]");
            const panel = document.querySelector("#userEditPanel");
            const form = document.querySelector("#userEditForm");
            if (row && panel && form) {
                form.elements.id.value = row.dataset.userId;
                form.elements.first_name.value = row.dataset.userFirst;
                form.elements.middle_name.value = row.dataset.userMiddle;
                form.elements.last_name.value = row.dataset.userLast;
                form.elements.username.value = row.dataset.userUsername;
                form.elements.email.value = row.dataset.userEmail;
                form.elements.phone.value = row.dataset.userPhone;
                form.elements.gender.value = row.dataset.userGender;
                form.elements.birthdate.value = row.dataset.userBirthdate;
                form.elements.address.value = row.dataset.userAddress;
                const departmentField = form.querySelector("[data-edit-department]");
                const roleField = form.querySelector("[data-edit-role]");
                departmentField.hidden = row.dataset.userType !== "employee";
                roleField.hidden = row.dataset.userType !== "employee";
                if (row.dataset.userDepartment) {
                    form.elements.department.value = row.dataset.userDepartment;
                }
                if (row.dataset.userRole) {
                    form.elements.role.value = row.dataset.userRole;
                }
                panel.hidden = false;
                panel.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }

        const cancelBooking = event.target.closest("[data-cancel-booking]");
        if (cancelBooking) {
            if (!window.confirm("Cancel this booking?")) {
                return;
            }
            try {
                const result = await api("request.php?action=customer-update", {
                    method: "POST",
                    body: JSON.stringify({
                        request_id: Number(cancelBooking.dataset.cancelBooking),
                        operation: "cancel"
                    })
                });
                showMessage(result.message);
                await loadRequests();
            } catch (error) {
                showMessage(error.message, true);
            }
            return;
        }

        const rescheduleBooking = event.target.closest("[data-reschedule-request]");
        if (rescheduleBooking && currentUser) {
            const requestId = Number(rescheduleBooking.dataset.rescheduleRequest);
            customerPage(currentUser, "support");
            const form = document.querySelector("#supportForm");
            form.elements.subject.value = `Reschedule booking #${requestId}`;
            form.elements.booking_id.value = String(requestId);
            form.elements.message.value = "I would like to request a different service date or time. Please contact me to coordinate.";
            return;
        }

        const userStatusButton = event.target.closest("[data-user-status]");
        if (userStatusButton) {
            try {
                const result = await api("admin.php?action=set-status", {
                    method: "POST",
                    body: JSON.stringify({
                        id: Number(userStatusButton.dataset.id),
                        status: userStatusButton.dataset.userStatus
                    })
                });
                showMessage(result.message);
                if (currentUser?.account_type === "admin") {
                    await refreshAdmin(currentUser, currentPortalTab);
                } else {
                    await loadEmployeeDirectory();
                }
            } catch (error) {
                showMessage(error.message, true);
            }
            return;
        }

        const ticketButton = event.target.closest("[data-save-ticket]");
        if (ticketButton) {
            const status = document.querySelector(
                `[data-ticket-status="${ticketButton.dataset.saveTicket}"]`
            )?.value;
            try {
                const result = await api("portal.php?action=update-ticket", {
                    method: "POST",
                    body: JSON.stringify({
                        ticket_id: Number(ticketButton.dataset.saveTicket),
                        status
                    })
                });
                showMessage(result.message);
                await loadTickets(true);
            } catch (error) {
                showMessage(error.message, true);
            }
            return;
        }

        const productToggle = event.target.closest("[data-toggle-product]");
        if (productToggle) {
            const row = productToggle.closest("[data-product-id]");
            try {
                const result = await api("catalog.php?action=save-product", {
                    method: "POST",
                    body: JSON.stringify({
                        id: Number(productToggle.dataset.toggleProduct),
                        name: row.dataset.productName,
                        category: row.dataset.productCategory,
                        description: row.dataset.productDescription,
                        price: row.dataset.productPrice || null,
                        availability: row.dataset.productAvailability,
                        image_url: row.dataset.productImage || "",
                        is_active: Number(productToggle.dataset.active)
                    })
                });
                showMessage(result.message);
                await refreshAdmin(currentUser, currentPortalTab);
            } catch (error) {
                showMessage(error.message, true);
            }
            return;
        }

        const editProduct = event.target.closest("[data-edit-product]");
        if (editProduct) {
            const row = editProduct.closest("[data-product-id]");
            const form = document.querySelector("#productForm");
            if (form && row) {
                form.elements.id.value = row.dataset.productId;
                form.elements.name.value = row.dataset.productName;
                form.elements.category.value = row.dataset.productCategory;
                form.elements.description.value = row.dataset.productDescription;
                form.elements.price.value = row.dataset.productPrice;
                form.elements.availability.value = row.dataset.productAvailability;
                form.elements.image_url.value = row.dataset.productImage;
                form.elements.is_active.value = row.dataset.productActive;
                form.closest(".form-panel").querySelector("#productFormTitle").textContent = "Edit solar product";
                form.querySelector('[type="submit"]').textContent = "Update product";
                form.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }

        const editTestimonial = event.target.closest("[data-edit-testimonial]");
        if (editTestimonial) {
            const row = editTestimonial.closest("[data-testimonial-id]");
            const form = document.querySelector("#testimonialForm");
            if (form && row) {
                form.elements.id.value = row.dataset.testimonialId;
                form.elements.customer_name.value = row.dataset.testimonialName;
                form.elements.quote.value = row.dataset.testimonialQuote;
                form.elements.rating.value = row.dataset.testimonialRating;
                form.elements.status.value = row.dataset.testimonialStatus;
                form.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }

        const decisionButton = event.target.closest("[data-decision]");

        if (decisionButton) {
            try {
                const result = await api(
                    "admin.php?action=decide",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            id: Number(decisionButton.dataset.id),
                            decision: decisionButton.dataset.decision
                        })
                    }
                );

                showMessage(result.message);
                await refreshAdmin();
            } catch (error) {
                showMessage(error.message, true);
            }

            return;
        }

        const assignButton = event.target.closest("[data-assign]");

        if (assignButton) {
            const requestId = assignButton.dataset.assign;

            const select = document.querySelector(
                `[data-assign-select="${requestId}"]`
            );
            const date = document.querySelector(
                `[data-schedule-date="${requestId}"]`
            );
            const start = document.querySelector(
                `[data-schedule-start="${requestId}"]`
            );
            const end = document.querySelector(
                `[data-schedule-end="${requestId}"]`
            );

            if (!select || !select.value || !date?.value || !start?.value || !end?.value) {
                showMessage("Select a worker, service date and time range.", true);
                return;
            }

            try {
                const result = await api(
                    "portal.php?action=schedule",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            request_id: Number(requestId),
                            worker_id: Number(select.value),
                            scheduled_date: date.value,
                            start_time: start?.value || "",
                            end_time: end?.value || "",
                            decision: "schedule"
                        })
                    }
                );

                showMessage(result.message);
                if (currentUser.account_type === "admin") {
                    await refreshAdmin(currentUser, currentPortalTab);
                } else {
                    await loadRequests();
                }
            } catch (error) {
                showMessage(error.message, true);
            }

            return;
        }

        const declineButton = event.target.closest("[data-decline]");

        if (declineButton) {
            try {
                const result = await api("portal.php?action=schedule", {
                    method: "POST",
                    body: JSON.stringify({
                        request_id: Number(declineButton.dataset.decline),
                        decision: "decline"
                    })
                });
                showMessage(result.message);
                if (currentUser.account_type === "admin") {
                    await refreshAdmin(currentUser, currentPortalTab);
                } else {
                    await loadRequests();
                }
            } catch (error) {
                showMessage(error.message, true);
            }

            return;
        }

        const activityButton = event.target.closest("[data-activity-request]");

        if (activityButton) {
            const requestId = activityButton.dataset.activityRequest;
            const container = document.querySelector(
                `[data-activity-container="${requestId}"]`
            );

            if (!container) {
                return;
            }

            if (!container.hidden) {
                container.hidden = true;
                return;
            }

            try {
                const result = await api(
                    `portal.php?action=activity&request_id=${encodeURIComponent(requestId)}`
                );
                container.innerHTML = result.activity.length
                    ? result.activity.map(item => `
                        <article>
                            <b>${escapeHTML(item.activity_type.replace("_", " "))}</b>
                            <small>${escapeHTML(item.employee_name)} · ${escapeHTML(item.created_at)}</small>
                            ${item.note ? `<p>${escapeHTML(item.note)}</p>` : ""}
                            ${item.latitude !== null && item.latitude !== undefined
                                ? `<small>GPS: ${escapeHTML(item.latitude)}, ${escapeHTML(item.longitude)}</small>`
                                : ""}
                        </article>
                    `).join("")
                    : '<small>No activity has been recorded.</small>';
                container.hidden = false;
            } catch (error) {
                showMessage(error.message, true);
            }

            return;
        }

        const updateButton = event.target.closest("[data-update-job]");

        if (updateButton) {
            const requestId = updateButton.dataset.updateJob;

            const statusInput = document.querySelector(
                `[data-job-status="${requestId}"]`
            );

            const notesInput = document.querySelector(
                `[data-job-notes="${requestId}"]`
            );

            try {
                const result = await api(
                    "request.php?action=update",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            id: Number(requestId),
                            status: statusInput.value,
                            worker_notes: notesInput.value
                        })
                    }
                );

                showMessage(result.message);
                await loadRequests();
            } catch (error) {
                showMessage(error.message, true);
            }

            return;
        }

        const workEventButton = event.target.closest("[data-work-event]");

        if (workEventButton) {
            const type = workEventButton.dataset.workEvent;
            const requestId = Number(workEventButton.dataset.requestId);
            const noteInput = document.querySelector(
                `[data-issue-note="${requestId}"]`
            );

            try {
                let location = {};
                if (type === "check_in") {
                    if (!navigator.geolocation) {
                        throw new Error("This browser does not support site location check-in.");
                    }
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(
                            resolve,
                            error => reject(new Error(
                                error.code === error.PERMISSION_DENIED
                                    ? "Location permission was denied. Allow location access to check in."
                                    : "Unable to determine your current location. Move to an area with GPS/network reception and retry."
                            )),
                            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                        );
                    });
                    location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                }
                const result = await api("portal.php?action=work-event", {
                    method: "POST",
                    body: JSON.stringify({
                        request_id: requestId,
                        activity_type: type,
                        note: type === "issue" ? noteInput?.value || "" : "",
                        report_type: type === "issue"
                            ? document.querySelector(`[data-issue-type="${requestId}"]`)?.value || "service"
                            : undefined,
                        ...location
                    })
                });
                showMessage(result.message);
                if (type === "issue" && noteInput) {
                    noteInput.value = "";
                }
                await loadRequests();
            } catch (error) {
                showMessage(error.message, true);
            }

            return;
        }

        const button = event.target.closest("[data-action]");

        if (!button) {
            return;
        }

        event.preventDefault();

        switch (button.dataset.action) {
            case "home":
                home();
                break;

            case "login":
                auth(false, button.dataset.loginType || "customer");
                break;

            case "register":
                auth(true);
                break;

            case "portal-tab":
                if (currentUser) {
                    renderPortal(currentUser, button.dataset.tab);
                }
                break;

            case "refresh-report":
                if (currentUser?.account_type === "admin") {
                    adminPage(currentUser, "reports");
                }
                break;

            case "logout":
                try {
                    await api("auth.php?action=logout", {
                        method: "POST",
                        body: "{}"
                    });

                    home();
                    currentUser = null;
                    showMessage("You have signed out.");
                } catch (error) {
                    showMessage(error.message, true);
                }

                break;
        }
    });

    // Show the homepage first, then restore an existing login if available.
    async function init() {
        home();

        if (["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
            try {
                const setup = await api("setup_admin.php");
                if (setup.created) {
                    showMessage(setup.message);
                }
            } catch (error) {
                showMessage(`Initial admin setup failed: ${error.message}`, true);
            }
        }

        try {
            const result = await api("auth.php?action=me");
            renderPortal(result.user);
        } catch {
            // No active session; keep the public homepage visible.
        }
    }

    init();
})();
