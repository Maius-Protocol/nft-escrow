use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

use crate::state::*;
use crate::errors::ErrorCodes;

#[derive(Accounts)]
pub struct ConfirmDelivery<'info> {
    #[account(
        mut,
        constraint = escrow.alice_key == alice.key() @ErrorCodes::InvalidBobOrAlice,
    )]
    pub alice: Signer<'info>,

    #[account(
        mut,
            seeds = [
            "escrow_vault".as_bytes(),
            escrow.alice_key.as_ref(),
            escrow.alice_nft_key.as_ref(),
            escrow.bob_key.as_ref()
        ],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        mut,
        seeds = [
            "vault_nft".as_bytes(),
            escrow.key().as_ref(),
            alice_nft.key().as_ref()
        ],
        bump,
        constraint = vault_nft.amount == 1,
        constraint = vault_nft.owner == authority_vault.key()
    )]
    pub vault_nft: Account<'info, TokenAccount>,

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
        constraint = alice_taker_token_account.mint == taker_token.key() @ErrorCodes::InvalidMintNft,
    )]
    pub alice_taker_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = bob_nft_account.mint == alice_nft.key() @ErrorCodes::InvalidMintNft,
    )]
    pub bob_nft_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = escrow.alice_nft_key == alice_nft.key() @ErrorCodes::InvalidMintNft,
    )]
    pub alice_nft: Account<'info, Mint>,
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

pub fn handler(ctx: Context<ConfirmDelivery>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    require!(
        escrow.status == StatusStage::TokenDeposited,
        ErrorCodes::InvalidEscrow
    );
    escrow.status = StatusStage::Delivered;

    // delivery nft to bob
    transfer(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_nft.to_account_info(),
            to: ctx.accounts.bob_nft_account.to_account_info(),
            authority: ctx.accounts.authority_vault.to_account_info(),
        },
        &[&["authority".as_bytes(),
            escrow.key().as_ref(),
            &[*ctx.bumps.get("authority_vault").unwrap()]]]
    ), 1)?;

    // delivery token to alice
    transfer(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_token.to_account_info(),
            to: ctx.accounts.alice_taker_token_account.to_account_info(),
            authority: ctx.accounts.authority_vault.to_account_info(),
        },
        &[&["authority".as_bytes(),
            escrow.key().as_ref(),
            &[*ctx.bumps.get("authority_vault").unwrap()]]]
    ), escrow.taker_amount)?;



    Ok(())
}
