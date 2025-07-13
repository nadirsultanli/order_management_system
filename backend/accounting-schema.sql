-- =============================================================================
-- ACCOUNTING SCHEMA (Optimized for OMS + Payments + Audit)
-- =============================================================================

-- CHART OF ACCOUNTS
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code VARCHAR(20) UNIQUE NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  account_type VARCHAR(20) NOT NULL
    CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  normal_balance VARCHAR(10) NOT NULL
    CHECK (normal_balance IN ('debit', 'credit'))
    DEFAULT CASE 
      WHEN account_type IN ('asset', 'expense') THEN 'debit'
      WHEN account_type IN ('liability', 'equity', 'revenue') THEN 'credit'
    END,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- JOURNAL ENTRIES
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number VARCHAR(50) UNIQUE NOT NULL,
  transaction_date TIMESTAMP NOT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(50),
    CHECK (reference_type IN ('payment', 'order', 'sweep', 'manual', 'reversal', 'adjustment')),
  reference_id UUID,
  customer_id UUID REFERENCES customers(id),
  paid_by UUID REFERENCES admin_users(id),
  total_amount DECIMAL(15,2) NOT NULL
    CHECK (total_amount >= 0),
  status VARCHAR(20) DEFAULT 'posted'
    CHECK (status IN ('draft', 'posted', 'reversed')),
  posted_by UUID REFERENCES admin_users(id),
  posted_at TIMESTAMP DEFAULT NOW(),
  reversed_by UUID REFERENCES admin_users(id),
  reversed_at TIMESTAMP,
  reversal_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- JOURNAL ENTRY LINES
CREATE TABLE journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit_amount DECIMAL(15,2) DEFAULT 0
    CHECK (debit_amount >= 0),
  credit_amount DECIMAL(15,2) DEFAULT 0
    CHECK (credit_amount >= 0),
  description TEXT,
  CONSTRAINT chk_debit_or_credit 
    CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)),
  entity_type VARCHAR(50),
  entity_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- PAYMENT-JOURNAL MAPPING
CREATE TABLE payment_journal_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(payment_id)
);

-- ACCOUNT BALANCES CACHE
CREATE TABLE account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  balance_date DATE NOT NULL,
  opening_balance DECIMAL(15,2) DEFAULT 0,
  period_debits DECIMAL(15,2) DEFAULT 0,
  period_credits DECIMAL(15,2) DEFAULT 0,
  closing_balance DECIMAL(15,2) DEFAULT 0,
  last_transaction_id UUID,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, balance_date)
);

-- INDEXES
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX idx_journal_entries_customer ON journal_entries(customer_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(transaction_date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_lines_account ON journal_entry_lines(account_id);
CREATE INDEX idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_entity ON journal_entry_lines(entity_type, entity_id);
CREATE INDEX idx_payment_journal_map ON payment_journal_map(payment_id);

-- CONSTRAINTS AND VALIDATION
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debits DECIMAL(15,2);
  total_credits DECIMAL(15,2);
BEGIN
  SELECT 
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0)
  INTO total_debits, total_credits
  FROM journal_entry_lines 
  WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  IF ABS(total_debits - total_credits) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry not balanced: Debits % != Credits %', total_debits, total_credits;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_check_journal_balance
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION check_journal_balance();

-- AUTO-GENERATE ENTRY NUMBERS
CREATE SEQUENCE journal_entry_seq START 1;

CREATE OR REPLACE FUNCTION generate_entry_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entry_number IS NULL OR NEW.entry_number = '' THEN
    NEW.entry_number := 'JE-' || LPAD(nextval('journal_entry_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_generate_entry_number
  BEFORE INSERT ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION generate_entry_number();

-- SUGGESTED DEFAULT ACCOUNTS (for reference)
-- INSERT INTO chart_of_accounts (account_code, account_name, account_type, normal_balance) VALUES
-- ('1100', 'M-Pesa Clearing', 'asset', 'debit'),
-- ('1200', 'Bank - KES', 'asset', 'debit'),
-- ('1300', 'Accounts Receivable', 'asset', 'debit'),
-- ('2100', 'Customer Credits', 'liability', 'credit'),
-- ('4100', 'Sales Revenue', 'revenue', 'credit'); 