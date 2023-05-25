use anchor_lang::prelude::*;
use crate::constants::*;


#[account]
#[derive()]
pub struct Escrow {
    pub alice_nft_key: Pubkey,
    pub bob_key: Pubkey,
    pub alice_key: Pubkey,
    pub taker_amount: u64,
    pub taker_token_key: Pubkey,
    pub status: StatusStage
}

#[derive(AnchorDeserialize,AnchorSerialize,PartialEq,Eq,Clone)]
pub enum StatusStage {
    NftDeposited,
    TokenDeposited,
    Delivered,
    CancelByAlice,
    CancelByBob,
}

impl Escrow {
    // FYI: https://github.com/coral-xyz/anchor/blob/master/lang/syn/src/codegen/program/handlers.rs#L98
    pub fn space() -> usize {
        8 +  // discriminator
        PUBKEY_SIZE + // alice_nft_key
        PUBKEY_SIZE + // bob_key
        PUBKEY_SIZE + // alice_key
        U64_SIZE + // taker_amount
        PUBKEY_SIZE + // taker_token_key
        1 + 1 // status
    }
}

