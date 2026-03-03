-- Update tax configuration in system_settings to reflect new Nigerian PAYE Tax Law
-- 1. CRA Removed (Set to 0)
-- 2. Gross Income Relief Removed (Set to 0)
-- 3. Rent Relief Introduced (Added rent_relief_percentage)
-- 4. New Tax Brackets (0%, 15%, 25%, 30%)

UPDATE system_settings
SET 
    value = jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    jsonb_set(
                        value, 
                        '{tax_configuration, consolidated_relief_allowance}', 
                        '0'
                    ),
                    '{tax_configuration, gross_income_relief_percentage}', 
                    '0'
                ),
                '{tax_configuration, rent_relief_percentage}', 
                '60'
            ),
            '{tax_configuration, tax_brackets}', 
            '[
                {"min": 0, "max": 800000, "rate": 0},
                {"min": 800000, "max": 2200000, "rate": 15},
                {"min": 2200000, "max": 9000000, "rate": 25},
                {"min": 9000000, "max": null, "rate": 30}
            ]'::jsonb
        ),
        '{tax_configuration, updated_at}', 
        to_jsonb(now())
    ),
    tax_configuration = jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    COALESCE(tax_configuration, '{}'::jsonb), 
                    '{consolidated_relief_allowance}', 
                    '0'
                ),
                '{gross_income_relief_percentage}', 
                '0'
            ),
            '{rent_relief_percentage}', 
            '60'
        ),
        '{tax_brackets}', 
        '[
            {"min": 0, "max": 800000, "rate": 0},
            {"min": 800000, "max": 2200000, "rate": 15},
            {"min": 2200000, "max": 9000000, "rate": 25},
            {"min": 9000000, "max": null, "rate": 30}
        ]'::jsonb
    )
WHERE key = 'general_settings';

-- Also update the legacy row if it exists (id='default')
UPDATE system_settings
SET 
    tax_configuration = jsonb_set(
        jsonb_set(
            jsonb_set(
                jsonb_set(
                    COALESCE(tax_configuration, '{}'::jsonb), 
                    '{consolidated_relief_allowance}', 
                    '0'
                ),
                '{gross_income_relief_percentage}', 
                '0'
            ),
            '{rent_relief_percentage}', 
            '60'
        ),
        '{tax_brackets}', 
        '[
            {"min": 0, "max": 800000, "rate": 0},
            {"min": 800000, "max": 2200000, "rate": 15},
            {"min": 2200000, "max": 9000000, "rate": 25},
            {"min": 9000000, "max": null, "rate": 30}
        ]'::jsonb
    )
WHERE id = 'default';
