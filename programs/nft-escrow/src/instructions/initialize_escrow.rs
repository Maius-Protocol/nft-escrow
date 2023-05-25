use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

use crate::state::{Escrow, StatusStage};
use crate::errors::ErrorCodes;

#[derive(Accounts)]
#[instruction(bob_key: Pubkey)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub alice: Signer<'info>,

    #[account(
        init_if_needed,
        seeds = [
            "escrow_vault".as_bytes(),
            alice.key().as_ref(),
            alice_nft.key().as_ref(),
            bob_key.as_ref(),
        ],
        bump,
        payer = alice,
        space = Escrow::space()
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(
        init_if_needed,
        seeds = [
            "vault_nft".as_bytes(),
            escrow.key().as_ref(),
            alice_nft.key().as_ref()
        ],
        bump,
        payer = alice,
        token::mint = alice_nft,
        token::authority = authority_vault,
    )]
    pub vault_nft: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        seeds = [
            "vault_token".as_bytes(),
            escrow.key().as_ref(),
            taker_token.key().as_ref()
        ],
        bump,
        payer = alice,
        token::mint = taker_token,
        token::authority = authority_vault,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    pub alice_nft: Account<'info, Mint>,
    #[account(
        mut,
        constraint = alice_nft_account.mint == alice_nft.key() @ErrorCodes::InvalidMintNft,
    )]
    pub alice_nft_account: Box<Account<'info, TokenAccount>>,
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

pub fn handler(ctx: Context<InitializeEscrow>, bob_key: Pubkey, taker_amount: u64) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    escrow.alice_nft_key = ctx.accounts.alice_nft.key();
    escrow.bob_key = bob_key;
    escrow.taker_amount = taker_amount;
    escrow.taker_token_key = ctx.accounts.taker_token.key();
    escrow.status = StatusStage::NftDeposited;
    escrow.alice_key = ctx.accounts.alice.key();

    let transfer_accounts = Transfer {
        from: ctx.accounts.alice_nft_account.to_account_info(),
        to: ctx.accounts.vault_nft.to_account_info(),
        authority: ctx.accounts.alice.to_account_info(),
    };

    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
    );

    transfer(transfer_ctx, 1)?;

    Ok(())
}
