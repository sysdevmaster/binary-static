const expect = require('chai').expect;
const State  = require('../../../_common/storage').State;
const { parseAttributeString,
        shouldShowElement } = require('../content_visibility').__test__;

describe('ContentVisibility', () => {
    describe('.parseAttributeString()', () => {
        it('works for a single inclusive', () => {
            expect(parseAttributeString('costarica')).to.deep.equal({
                is_exclude  : false,
                names       : ['costarica'],
                mt5fin_rules: [],
            });
        });
        it('works for two inclusive', () => {
            expect(parseAttributeString('mtcompany, costarica')).to.deep.equal({
                is_exclude  : false,
                names       : ['mtcompany', 'costarica'],
                mt5fin_rules: [],
            });
        });
        it('works for a single exclusive', () => {
            expect(parseAttributeString('-costarica')).to.deep.equal({
                is_exclude  : true,
                names       : ['costarica'],
                mt5fin_rules: [],
            });
        });
        it('works for two exclusive', () => {
            expect(parseAttributeString('-default, -costarica')).to.deep.equal({
                is_exclude  : true,
                names       : ['default', 'costarica'],
                mt5fin_rules: [],
            });
        });
        it('works for a single mt5 rule', () => {
            expect(parseAttributeString('mt5fin:vanuatu')).to.deep.equal({
                is_exclude  : false,
                names       : [],
                mt5fin_rules: ['vanuatu'],
            });
        });
        it('works for a mix of rules', () => {
            expect(parseAttributeString('-maltainvest,  -default, -mt5fin:vanuatu')).to.deep.equal({
                is_exclude  : true,
                names       : ['maltainvest', 'default'],
                mt5fin_rules: ['vanuatu'],
            });
            expect(parseAttributeString('maltainvest, mt5fin:vanuatu, costarica')).to.deep.equal({
                is_exclude  : false,
                names       : ['maltainvest', 'costarica'],
                mt5fin_rules: ['vanuatu'],
            });
        });
    });

    describe('.shouldShowElement()', () => {
        it('works with inclusive landing companies', () => {
            expect(shouldShowElement('costarica', 'costarica', false, ['vanuatu'])).to.equal(true);
            expect(shouldShowElement('costarica', 'malta', false, ['vanuatu'])).to.equal(false);
            expect(shouldShowElement('default, costarica', 'malta', false, '')).to.equal(false);
            expect(shouldShowElement('default, malta', 'maltainvest', false, '')).to.equal(false);
            expect(shouldShowElement('costarica, malta', 'malta', false, '')).to.equal(true);
        });
        it('works with exclusive landing companies', () => {
            expect(shouldShowElement('-costarica', 'costarica', false, ['vanuatu'])).to.equal(false);
            expect(shouldShowElement('-costarica', 'malta', false, ['vanuatu'])).to.equal(true);
            expect(shouldShowElement('-maltainvest, -costarica', 'malta', false, '')).to.equal(true);
            expect(shouldShowElement('-malta, -maltainvest', 'maltainvest', false, ['vanuatu'])).to.equal(false);
            expect(shouldShowElement('-costarica, -malta', 'costarica', false, ['vanuatu'])).to.equal(false);
        });
        it('works with inclusive mtcompany check', () => {
            expect(shouldShowElement('mtcompany', 'malta', true, 'vanuatu')).to.equal(true);
            expect(shouldShowElement('malta, mtcompany', 'malta', true, ['vanuatu'])).to.equal(true);
            expect(shouldShowElement('maltainvest, mtcompany', 'malta', false, ['vanuatu'])).to.equal(false);
        });
        it('works with exclusive mtcompany check', () => {
            expect(shouldShowElement('-mtcompany', 'malta', true, ['vanuatu'])).to.equal(false);
            expect(shouldShowElement('-malta, -mtcompany', 'malta', true, ['vanuatu'])).to.equal(false);
            expect(shouldShowElement('-maltainvest, -mtcompany', 'malta', false, ['vanuatu'])).to.equal(true);
        });
        it('works with inclusive mt5fin rule', () => {
            expect(shouldShowElement('mt5fin:vanuatu', 'malta', true, '')).to.equal(false);
            expect(shouldShowElement('mt5fin:vanuatu', 'malta', true, ['vanuatu'])).to.equal(true);
        });
        it('works with exclusive mt5fin rule', () => {
            expect(shouldShowElement('-mt5fin:vanuatu', 'malta', true, ['vanuatu'])).to.equal(false);
            expect(shouldShowElement('-mt5fin:vanuatu', 'malta', true, '')).to.equal(true);
        });
        it('works with inclusive eucountry rule (eu-client)', () => {
            const landing_company = { landing_company: { financial_company: { name: 'Binary Investments (Europe) Ltd', shortcode: 'maltainvest' }, gaming_company: { name: 'Binary (Europe) Ltd', shortcode: 'malta' } }, msg_type: 'landing_company' };
            State.set(['response', 'landing_company'], landing_company);
            State.set(['response', 'website_status', 'website_status', 'clients_country'], [ 'nl' ]);
            expect(shouldShowElement('eucountry', 'malta', true, '')).to.equal(true);
        });
        it('works with exclusive eucountry rule (eu-client)', () => {
            const landing_company = { landing_company: { financial_company: { name: 'Binary Investments (Europe) Ltd', shortcode: 'maltainvest' }, gaming_company: { name: 'Binary (Europe) Ltd', shortcode: 'malta' } }, msg_type: 'landing_company' };
            State.set(['response', 'landing_company'], landing_company);
            State.set(['response', 'website_status', 'website_status', 'clients_country'], [ 'nl' ]);
            expect(shouldShowElement('-eucountry', 'malta', true, '')).to.equal(false);
        });
        it('works with inclusive eucountry rule (non-eu-client)', () => {
            const landing_company = { landing_company: { gaming_company: { shortcode: 'costarica' } }, msg_type: 'landing_company' };
            State.set(['response', 'landing_company'], landing_company);
            State.set(['response', 'website_status', 'website_status', 'clients_country'], [ 'br' ]);
            expect(shouldShowElement('eucountry', 'costarica', true, '')).to.equal(false);
        });
        it('works with exclusive eucountry rule (non-eu-client)', () => {
            const landing_company = { landing_company: { gaming_company: { shortcode: 'costarica' } }, msg_type: 'landing_company' };
            State.set(['response', 'landing_company'], landing_company);
            State.set(['response', 'website_status', 'website_status', 'clients_country'], [ 'br' ]);
            expect(shouldShowElement('-eucountry', 'costarica', true, '')).to.equal(true);
        });
        it('works with inclusive eucountry rule mt country', () => {
            const landing_company = {};
            State.set(['response', 'landing_company'], landing_company);
            State.set(['response', 'website_status', 'website_status', 'clients_country'], [ 'mt' ]);
            expect(shouldShowElement('eucountry', '', true, '')).to.equal(true);
        });
        it('works with exclusive eucountry rule mt country', () => {
            const landing_company = {};
            State.set(['response', 'landing_company'], landing_company);
            State.set(['response', 'website_status', 'website_status', 'clients_country'], [ 'mt' ]);
            expect(shouldShowElement('-eucountry', '', true, '')).to.equal(false);
        });
    });
});
