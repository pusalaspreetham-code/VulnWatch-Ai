BEGIN;

-- 1. User accounts
-- Store only a securely hashed password, never the original password.
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON users (LOWER(email));


-- 2. Software products each user wants to monitor
CREATE TABLE IF NOT EXISTS stack_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor VARCHAR(255),
    product_name VARCHAR(255) NOT NULL,
    installed_version VARCHAR(100) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Supports ownership checks in related tables.
    UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS stack_items_user_id_idx
    ON stack_items(user_id);


-- 3. Shared advisory records collected from sources
CREATE TABLE IF NOT EXISTS advisories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cve_id VARCHAR(30),
    source_name VARCHAR(255) NOT NULL,
    source_advisory_id VARCHAR(255),
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity VARCHAR(30),
    cvss_score NUMERIC(4, 1),
    remediation TEXT,
    published_at TIMESTAMPTZ,
    source_modified_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        cvss_score IS NULL
        OR (cvss_score >= 0 AND cvss_score <= 10)
    )
);

-- A CVE should not be stored twice.
CREATE UNIQUE INDEX IF NOT EXISTS advisories_cve_id_unique
    ON advisories(cve_id)
    WHERE cve_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS advisories_published_at_idx
    ON advisories(published_at DESC);


-- 4. Products and affected version ranges stated in each advisory
CREATE TABLE IF NOT EXISTS affected_products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    advisory_id BIGINT NOT NULL
        REFERENCES advisories(id) ON DELETE CASCADE,
    vendor VARCHAR(255),
    product_name VARCHAR(255) NOT NULL,

    -- Optional identifiers from the source, if available.
    cpe VARCHAR(500),

    -- Keep the source's original version information for traceability.
    affected_versions_raw TEXT,

    -- Optional structured bounds for version matching.
    version_start VARCHAR(100),
    version_start_inclusive BOOLEAN,
    version_end VARCHAR(100),
    version_end_inclusive BOOLEAN,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS affected_products_advisory_id_idx
    ON affected_products(advisory_id);

CREATE INDEX IF NOT EXISTS affected_products_product_name_idx
    ON affected_products(product_name);


-- 5. Potential matches between a user's stack and an affected product
CREATE TABLE IF NOT EXISTS matches (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stack_item_id BIGINT NOT NULL,
    affected_product_id BIGINT NOT NULL
        REFERENCES affected_products(id) ON DELETE CASCADE,

    status VARCHAR(30) NOT NULL DEFAULT 'needs_review',
    match_reason TEXT,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (status IN ('potential_match', 'no_match', 'needs_review')),

    -- Ensure the stack item belongs to this user.
    FOREIGN KEY (stack_item_id, user_id)
        REFERENCES stack_items(id, user_id)
        ON DELETE CASCADE,

    -- Prevent duplicate matches for the same stack item and affected product.
    UNIQUE (stack_item_id, affected_product_id),

    -- Supports ownership checks for review history.
    UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS matches_user_id_idx
    ON matches(user_id);

CREATE INDEX IF NOT EXISTS matches_status_idx
    ON matches(status);


-- 6. Analyst review history
CREATE TABLE IF NOT EXISTS review_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id BIGINT NOT NULL,
    review_status VARCHAR(30) NOT NULL,
    notes TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (review_status IN ('reviewed', 'confirmed', 'not_affected', 'dismissed')),

    -- Ensure the reviewed match belongs to this user.
    FOREIGN KEY (match_id, user_id)
        REFERENCES matches(id, user_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS review_history_user_id_idx
    ON review_history(user_id);

CREATE INDEX IF NOT EXISTS review_history_match_id_idx
    ON review_history(match_id);


COMMIT;