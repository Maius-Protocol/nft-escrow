use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::ErrorCodes;

#[derive(Accounts)]
pub struct DepositTakerToken<'info> {
    #[account(
        mut,
        constraint = escrow.bob_key == bob.key() @ErrorCodes::InvalidBobOrAlice,
    )]
    pub bob: Signer<'info>,

    #[account(
        mut,
        seeds = [
            "escrow_vault".as_bytes(),
            escrow.alice_key.as_ref(),
            escrow.alice_nft_key.as_ref(),
            bob.key().as_ref(),
        ],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [
            "vault_token".as_bytes(),
            escrow.key().as_ref(),
            taker_token.key().as_ref()
        ],
        bump,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = bob_taker_token_account.mint == taker_token.key() @ErrorCodes::InvalidMintNft,
    )]
    pub bob_taker_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = escrow.taker_token_key == taker_token.key() @ErrorCodes::InvalidMintNft,
    )]
    pub taker_token: Box<Account<'info, Mint>>,

    /// CHECK authority_vault
    #[account(
        mut,
        seeds = [
            "authority".as_bytes(),
            escrow.key().as_ref()
        ],
        bump
    )]
    pub authority_vault: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>
}

pub fn handler(ctx: Context<DepositTakerToken>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    require!(
        escrow.status == StatusStage::NftDeposited,
        ErrorCodes::InvalidEscrow
    );
    escrow.status = StatusStage::TokenDeposited;

    let transfer_accounts = Transfer {
        from: ctx.accounts.bob_taker_token_account.to_account_info(),
        to: ctx.accounts.vault_token.to_account_info(),
        authority: ctx.accounts.bob.to_account_info(),
    };

    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
    );

    transfer(transfer_ctx, escrow.taker_amount)?;

    Ok(())
}
