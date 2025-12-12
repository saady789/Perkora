-- Perks table for storing employee benefits and discounts
CREATE TABLE IF NOT EXISTS perks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    description TEXT,
    benefit_type TEXT,
    discount TEXT,
    link TEXT NOT NULL,
    category TEXT,
    eligibility TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups by company and category
CREATE INDEX IF NOT EXISTS idx_perks_company ON perks(company);
CREATE INDEX IF NOT EXISTS idx_perks_category ON perks(category);

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_perks_timestamp 
    AFTER UPDATE ON perks
BEGIN
    UPDATE perks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;