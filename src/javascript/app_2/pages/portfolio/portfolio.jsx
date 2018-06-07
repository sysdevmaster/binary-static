import React                from 'react';
import moment               from 'moment';
import PortfolioCard        from './portfolio_card.jsx';
import DataTable            from '../../components/elements/data_table.jsx';
import Tooltip              from '../../components/elements/tooltip.jsx';
import DAO                  from '../../data/dao';
import { getAppId }         from '../../../config';
import ClientBase           from '../../../_common/base/client_base';
import { formatMoney }      from '../../../_common/base/currency_base';
import { localize }         from '../../../_common/localize';
import { getPropertyValue } from '../../../_common/utility';
import Loading              from '../../../../templates/_common/components/loading.jsx';

const formatPortfolioData = (portfolio_arr) => {
    const formatted_portfolio = portfolio_arr.map((portfolio_item) => {
        const moment_obj      = moment.utc(portfolio_item.expiry_time * 1000);
        const remaining_time  = `${moment_obj.fromNow(true)} - ${moment_obj.format('h:mm:ss')}`;
        const purchase        = parseFloat(portfolio_item.buy_price);
        const payout          = parseFloat(portfolio_item.payout);
        return {
            reference: {
                transaction_id: portfolio_item.transaction_id,
                app_id        : portfolio_item.app_id,
            },
            type      : portfolio_item.contract_type,
            details   : localize(portfolio_item.longcode.replace(/\n/g, '<br />')),
            purchase  : formatMoney(false, purchase, true),
            payout    : formatMoney(false, payout, true),
            remaining_time,
            id        : portfolio_item.contract_id,
            indicative: {
                amount: '',
                style : '',
            },
        };
    });
    return formatted_portfolio;
};

// TODO: move to common
const contract_type_display = {
    ASIANU      : 'Asian Up',
    ASIAND      : 'Asian Down',
    CALL        : 'Higher',
    CALLE       : 'Higher or equal',
    PUT         : 'Lower',
    DIGITMATCH  : 'Digit Matches',
    DIGITDIFF   : 'Digit Differs',
    DIGITODD    : 'Digit Odd',
    DIGITEVEN   : 'Digit Even',
    DIGITOVER   : 'Digit Over',
    DIGITUNDER  : 'Digit Under',
    EXPIRYMISS  : 'Ends Outside',
    EXPIRYRANGE : 'Ends Between',
    EXPIRYRANGEE: 'Ends Between',
    LBFLOATCALL : 'Close-Low',
    LBFLOATPUT  : 'High-Close',
    LBHIGHLOW   : 'High-Low',
    RANGE       : 'Stays Between',
    UPORDOWN    : 'Goes Outside',
    ONETOUCH    : 'Touches',
    NOTOUCH     : 'Does Not Touch',
};

// TODO: move to common
const buildOauthApps = (response) => {
    if (!response || !response.oauth_apps) return {};
    const obj_oauth_apps = { 2: 'Binary.com Autoexpiry' };
    response.oauth_apps.forEach((app) => {
        obj_oauth_apps[app.app_id] = app.name;
    });
    return obj_oauth_apps;
};

const app_id = getAppId();

class Portfolio extends React.PureComponent  {
    state = {
        columns: [
            {
                title     : localize('Reference No.'),
                data_index: 'reference',
                renderCell: (data, data_index) => {
                    const tooltip =
                        (data.app_id !== app_id) && this.state.oauth_apps && this.state.oauth_apps[data.app_id];

                    if (tooltip) {
                        return (
                            <td key={data_index} className={data_index}>
                                <Tooltip
                                    alignment='right'
                                    message={localize('Transaction performed by [_1] (APP ID: [_2])', [tooltip, data.app_id])}
                                >
                                    {data.transaction_id}
                                </Tooltip>
                            </td>);
                    }
                    return (
                        <td key={data_index} className={data_index}>
                            {data.transaction_id || ''}
                        </td>
                    );
                },
            },
            {
                title     : localize('Contract Type'),
                data_index: 'type',
                renderCell: (data, data_index) => {
                    if (data) {
                        return (
                            <td key={data_index}>
                                <div className={`${data_index}_container`}>
                                    <i className={`trade_type_icon icon_${data.toLowerCase()}--light`} />
                                    {localize(contract_type_display[data])}
                                </div>
                            </td>);
                    }
                    return ( <td key={data_index} />);
                },
            },
            {
                title     : localize('Contract Details'),
                data_index: 'details',
            },
            {
                title     : localize('Remaining Time (GMT)'),
                data_index: 'remaining_time',
            },
            {
                title     : localize('Potential Payout'),
                data_index: 'payout',
                renderCell: (data, data_index) => (<td key={data_index} className={data_index}> <span className={`symbols ${this.state.currency}`}/>{data}</td>),
            },
            {
                title     : localize('Purchase'),
                data_index: 'purchase',
                renderCell: (data, data_index) => (<td key={data_index} className={data_index}> <span className={`symbols ${this.state.currency}`}/>{data}</td>),
            },
            {
                title     : localize('Indicative'),
                data_index: 'indicative',
                renderCell: (data, data_index) => {
                    if (data.amount) {
                        return (
                            <td key={data_index} className={`indicative ${data.style}`}>
                                <span className={`symbols ${this.state.currency}`}/>{data.amount}
                                {data.style === 'no_resale' && <div> {localize('resell not offered')}</div>}
                            </td>);
                    }
                    // Footer total:
                    if (data && typeof data === 'string') {
                        return <td key={data_index} className={data_index}> <span className={`symbols ${this.state.currency}`}/>{data}</td>;
                    }
                    return <td key={data_index}>-</td>;
                },
            },
        ],
        currency   : ClientBase.get('currency').toLowerCase(),
        data_source: [],
        error      : null,
        footer     : {
            reference : 'Total',
            payout    : '',
            purchase  : '',
            indicative: '',
        },
        is_loading: true,
        oauth_apps: null,
    }

    componentWillMount() {
        this.initializePortfolio();
    }

    componentWillUnmount() {     // eslint-disable-line class-methods-use-this
        DAO.forgetAll('proposal_open_contract', 'transaction');
    }

    initializePortfolio = () => {
        DAO.getPortfolio().then((response) => {
            this.setState({ is_loading: false });
            this.updatePortfolio(response);
        });
        DAO.subscribeTransaction(this.transactionResponseHandler, false);
        DAO.getOauthApps().then((response) => this.updateOAuthApps(response));
    }

    transactionResponseHandler = (response) => {
        if (getPropertyValue(response, 'error')) {
            this.setState({ error: response.error.message });
        }
        DAO.getPortfolio().then((res) => this.updatePortfolio(res));
    }

    updateIndicative = (response) => {
        // prevent callback after component has unmounted
        if (!this.el) return;
        if (getPropertyValue(response, 'error')) {
            return;
        }
        let data_source = this.state.data_source.slice();
        const proposal  = response.proposal_open_contract;
        // force to sell the expired contract, in order to remove from portfolio
        if (+proposal.is_settleable === 1 && !proposal.is_sold) {
            DAO.sellExpired();
        }
        if (+proposal.is_sold === 1) {
            data_source = data_source.filter((portfolio_item) => portfolio_item.id !== +proposal.contract_id);
        } else {
            data_source.forEach(portfolio_item => {
                if (portfolio_item.id === +proposal.contract_id) {
                    const indicative = portfolio_item.indicative.amount || '0.00';
                    const amount = formatMoney(false, proposal.bid_price, true);
                    let style = portfolio_item.indicative.style;

                    if (+proposal.is_valid_to_sell === 1) {
                        if (amount !== indicative) {
                            style = amount > indicative ? 'price_moved_up' : 'price_moved_down';
                        }
                    } else {
                        style = 'no_resale';
                    }
                    portfolio_item.indicative = { style, amount };
                }
            });
        }
        const footer = this.updateFooterTotals(data_source);
        this.setState({ data_source, footer });
    }

    updateFooterTotals = (portfolioArr) => {
        let indicative = 0;
        let payout     = 0;
        let purchase   = 0;

        portfolioArr.forEach((portfolio_item) => {
            indicative += (+portfolio_item.indicative.amount);
            payout     += (+portfolio_item.payout);
            purchase   += (+portfolio_item.purchase);
        });
        return {
            ...this.state.footer,
            indicative: formatMoney(false, indicative, true),
            payout    : formatMoney(false, payout, true),
            purchase  : formatMoney(false, purchase, true),
        };
    }

    updateOAuthApps = (response) => {
        const oauth_apps = buildOauthApps(response);
        this.setState({ oauth_apps });
    };

    updatePortfolio = (response) => {
        if (getPropertyValue(response, 'error')) {
            this.setState({ error: response.error.message });
            return;
        }
        if (response.portfolio.contracts && response.portfolio.contracts.length !== 0) {
            const data_source = formatPortfolioData(response.portfolio.contracts);
            const footer      = this.updateFooterTotals(data_source);

            this.setState({ data_source, footer });

            DAO.subscribeProposalOpenContract(this.updateIndicative, false);
        }
    }

    render() {
        return (
            <div className='portfolio' ref={(el) => this.el = el}>
                <div className='portfolio_header_container'>
                    <h2>{localize('Portfolio')}</h2>
                </div>
                {(() => {
                    const {error, is_loading} = this.state;

                    if (is_loading) {
                        return <Loading />;
                    }
                    if (error) {
                        return <p>{this.state.error}</p>;
                    }
                    return (
                            this.state.data_source.length > 0 ?
                                <div>
                                    <div className='desktop-only'>
                                        <DataTable
                                            {...this.props}
                                            columns={this.state.columns}
                                            data_source={this.state.data_source}
                                            footer={this.state.footer}
                                        />
                                    </div>
                                    <div className='mobile-only'>
                                        {this.state.data_source.map((transaction, idx) => (
                                            <div key={idx} className='card-list'>
                                                <PortfolioCard
                                                    {...transaction}
                                                    currency={this.state.currency}
                                                />
                                            </div>)
                                        )}
                                    </div>
                                </div>
                            : <p>{localize('No open positions.')}</p>
                    );
                })()}
            </div>
        );
    }
};

export default Portfolio;
