pub mod instructions;
pub mod state;
pub mod errors;
pub mod constants;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("2ecirqhaPAcPrSJCpP2r32djQiQejLdhEtfL4K1gtj7d");

#[program]
pub mod nft_escrow {
    use super::*;

    pub fn initialize_escrow(ctx: Context<InitializeEscrow>, bob_key: Pubkey, taker_amount: u64) -> Result<()> {
        initialize_escrow::handler(ctx, bob_key, taker_amount);
        Ok(())
    }

    pub fn cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()> {
        cancel_escrow::handler(ctx);
        Ok(())
    }

    pub fn deposit_taker_token(ctx: Context<DepositTakerToken>) -> Result<()> {
        deposit_taker_token::handler(ctx);
        Ok(())
    }

    pub fn confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
        confirm_delivery::handler(ctx);
        Ok(())
    }
}

